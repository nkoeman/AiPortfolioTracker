"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { SidebarNav } from "@/components/SidebarNav";

type AppShellProps = {
  children: React.ReactNode;
  sessionEmail?: string | null;
  hasSession: boolean;
};

// Renders the main app shell, but hides it for auth routes like /login.
export function AppShell({ children, sessionEmail, hasSession }: AppShellProps) {
  const pathname = usePathname();
  const hideShell = pathname === "/login" || pathname === "/register";

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Image
            src="/brand/Chief_Capital_logo.png"
            alt="Chief Capital logo"
            width={420}
            height={120}
            className="brand-logo-full"
            priority
          />
          <Image
            src="/brand/Chief_Capital_logo.png"
            alt="Chief Capital mark"
            width={120}
            height={120}
            className="brand-logo-mark"
            priority
          />
        </div>
        <SidebarNav />
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div />
          <div className="topbar-actions">
            {sessionEmail ? (
              <span className="topbar-user">Logged in as: {sessionEmail}</span>
            ) : (
              <span className="topbar-user">Not signed in</span>
            )}
            {hasSession ? <LogoutButton /> : <Link href="/login">Login</Link>}
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
