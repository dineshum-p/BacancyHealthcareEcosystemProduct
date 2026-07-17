"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/src/components/brand/Wordmark";
import { useCurrentUser } from "@/src/lib/auth/useCurrentUser";
import {
  clearStoredAccessToken,
  clearStoredRefreshToken,
} from "@/src/lib/auth/session";

const NAV_ITEMS = [
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/audit-logs", label: "Audit log", icon: ScrollText },
];

export interface ConsoleShellProps {
  children: ReactNode;
}

/** Shared shell for the Super Admin console: a sidebar (nav + identity) plus a content area. */
export function ConsoleShell({ children }: ConsoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();

  function handleSignOut() {
    clearStoredAccessToken();
    clearStoredRefreshToken();
    router.replace("/login");
  }

  return (
    <div className="flex flex-1 bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/70 bg-sidebar px-4 py-6">
        <div className="px-2">
          <Wordmark size="sm" />
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border/70 pt-4">
          {user && (
            <div className="flex flex-col gap-0.5 px-3">
              <span className="text-xs font-medium text-foreground">
                {user.role}
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {user.userId}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-accent-foreground"
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
