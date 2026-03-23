"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { SidebarNav } from "@/components/SidebarNav";
import { PortfolioChatWidget } from "@/components/chat/PortfolioChatWidget";

type AppShellProps = {
  children: React.ReactNode;
  hasSession: boolean;
};

// Renders the main app shell, but hides it for auth routes like /login.
export function AppShell({ children, hasSession }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hideShell = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
        <div className="sidebar-auth">
          {hasSession ? <LogoutButton /> : <Link href="/login">Login</Link>}
        </div>
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="sidebar-drawer-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside className={`sidebar-drawer${mobileNavOpen ? " open" : ""}`} aria-hidden={!mobileNavOpen}>
        <div className="brand">
          <Image
            src="/brand/Chief_Capital_logo.png"
            alt="Chief Capital logo"
            width={420}
            height={120}
            className="brand-logo-full"
            priority
          />
        </div>
        <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        <div className="drawer-auth stack-sm">
          {hasSession ? <LogoutButton /> : <Link href="/login">Login</Link>}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <span aria-hidden="true" className="hamburger-icon">
              ☰
            </span>
          </button>
          <Image
            src="/brand/Chief_Capital_logo.png"
            alt="Chief Capital"
            width={180}
            height={52}
            className="mobile-topbar-logo"
            priority
          />
        </header>
        <main>{children}</main>
      </div>
      {hasSession ? <PortfolioChatWidget /> : null}
    </div>
  );
}
