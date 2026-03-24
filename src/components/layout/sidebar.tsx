"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  Bell,
  TrendingUp,
  BarChart3,
  Lightbulb,
  FileText,
  Bot,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/campaigns",
    label: "Campanhas",
    icon: Megaphone,
  },
  {
    href: "/alerts",
    label: "Alertas",
    icon: Bell,
    badge: "alertas",
  },
  {
    href: "/forecast",
    label: "Forecast",
    icon: TrendingUp,
  },
  {
    href: "/benchmarks",
    label: "Benchmarks",
    icon: BarChart3,
  },
  {
    href: "/suggestions",
    label: "Sugestões",
    icon: Lightbulb,
  },
  {
    href: "/reports",
    label: "Relatórios",
    icon: FileText,
  },
  {
    href: "/consultor",
    label: "Consultor IA",
    icon: Bot,
  },
  {
    href: "/billing",
    label: "Cobrança",
    icon: CreditCard,
  },
  {
    href: "/settings",
    label: "Configurações",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center min-w-0">
          {collapsed ? (
            <Image
              src="/favicon-nufluma.png"
              alt="Nufluma"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0"
            />
          ) : (
            <Image
              src="/logo-nufluma.png"
              alt="Nufluma"
              width={130}
              height={36}
              className="h-auto w-32"
              priority
            />
          )}
        </Link>
      </div>

      {/* Workspace badge */}
      {!collapsed && session?.user?.workspaceName && (
        <div className="px-4 py-2 border-b border-border">
          <p className="text-xs text-muted-foreground truncate">Workspace</p>
          <p className="text-sm font-medium truncate text-foreground">
            {session.user.workspaceName}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary/10 text-primary border-l-2 border-primary ml-px"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!collapsed && item.badge === "alertas" && (
                    <Badge
                      variant="destructive"
                      className="ml-auto h-4 min-w-4 px-1 text-[10px]"
                    >
                      !
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
