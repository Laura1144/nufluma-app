import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 dias
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (token.id) {
        // Attach active workspace to token
        const member = await db.workspaceMember.findFirst({
          where: { userId: token.id as string },
          orderBy: { joinedAt: "asc" },
          include: { workspace: true },
        });

        if (member) {
          token.workspaceId = member.workspaceId;
          token.workspaceName = member.workspace.name;
          token.workspaceSlug = member.workspace.slug;
          token.role = member.role;

          // Attach subscription status to token
          const sub = await db.subscription.findFirst({
            where: { workspaceId: member.workspaceId },
            orderBy: { createdAt: "desc" },
          });
          token.subscriptionStatus = sub?.status ?? "NONE";
          token.trialEndsAt = sub?.trialEndsAt?.toISOString() ?? null;
          token.currentPeriodEnd = sub?.currentPeriodEnd?.toISOString() ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.workspaceId = token.workspaceId as string;
        session.user.workspaceName = token.workspaceName as string;
        session.user.workspaceSlug = token.workspaceSlug as string;
        session.user.role = token.role as string;
        session.user.subscriptionStatus = token.subscriptionStatus as string;
        session.user.trialEndsAt = token.trialEndsAt as string | null;
        session.user.currentPeriodEnd = token.currentPeriodEnd as string | null;
      }
      return session;
    },
  },
});

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      workspaceId?: string;
      workspaceName?: string;
      workspaceSlug?: string;
      role?: string;
      subscriptionStatus?: string;
      trialEndsAt?: string | null;
      currentPeriodEnd?: string | null;
    };
  }
}
