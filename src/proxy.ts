import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/onboarding"];
const authRoutes = ["/login"];

function isSubscriptionValid(user: {
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const status = user.subscriptionStatus;
  if (!status || status === "NONE") return false;
  if (status === "CANCELLED" || status === "EXPIRED") return false;
  if (status === "PAST_DUE") return false;

  const now = new Date();

  if (status === "TRIALING") {
    if (!user.trialEndsAt) return false;
    return new Date(user.trialEndsAt) > now;
  }

  if (status === "ACTIVE") {
    if (!user.currentPeriodEnd) return true; // sem data = ativo sem restrição
    return new Date(user.currentPeriodEnd) > now;
  }

  return false;
}

export default auth((req: NextRequest & { auth?: { user?: { id?: string; workspaceId?: string; subscriptionStatus?: string; trialEndsAt?: string | null; currentPeriodEnd?: string | null } } | null }) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth?.user?.id;
  const hasWorkspace = !!req.auth?.user?.workspaceId;

  // Allow public routes and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/payment") ||
    pathname.startsWith("/api/subscription") ||
    pathname === "/api/health" ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon-nufluma.png" ||
    pathname === "/logo-nufluma.png" ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && authRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protect dashboard routes
  if (!isAuthenticated && !publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect to onboarding if no workspace
  if (
    isAuthenticated &&
    !hasWorkspace &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Verificação de subscription — bloqueia acesso se expirada/cancelada
  if (
    isAuthenticated &&
    hasWorkspace &&
    !pathname.startsWith("/billing") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/onboarding")
  ) {
    const user = req.auth?.user;
    if (user && !isSubscriptionValid(user)) {
      return NextResponse.redirect(new URL("/billing", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
