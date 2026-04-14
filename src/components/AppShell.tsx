"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { SidebarNav } from "@/components/SidebarNav";
import { PortfolioChatWidget } from "@/components/chat/PortfolioChatWidget";

type AppShellProps = {
  children: React.ReactNode;
};

// Renders the main app shell, but hides it for auth routes like /sign-in.
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hideShell =
    pathname === "/" ||
    pathname === "/portfolio" ||
    pathname === "/import" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

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
            src="/brand/ETFMinded_logo_full.png"
            alt="ETFMinded logo"
            width={420}
            height={120}
            className="brand-logo-full"
            priority
          />
          <Image
            src="/brand/ETFMinded_logo_only.png"
            alt="ETFMinded mark"
            width={120}
            height={120}
            className="brand-logo-mark"
            priority
          />
        </div>
        <SidebarNav />
        <div className="sidebar-auth">
          <SignedIn>
            <div className="stack-sm">
              <UserButton afterSignOutUrl="/sign-in" />
              <SignOutButton redirectUrl="/sign-in">
                <button type="button" className="secondary">Sign out</button>
              </SignOutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in">Sign in</Link>
          </SignedOut>
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
            src="/brand/ETFMinded_logo_full.png"
            alt="ETFMinded logo"
            width={420}
            height={120}
            className="brand-logo-full"
            priority
          />
        </div>
        <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        <div className="drawer-auth stack-sm">
          <SignedIn>
            <UserButton afterSignOutUrl="/sign-in" />
            <SignOutButton redirectUrl="/sign-in">
              <button type="button" className="secondary">Sign out</button>
            </SignOutButton>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in">Sign in</Link>
          </SignedOut>
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
              &#9776;
            </span>
          </button>
          <Image
            src="/brand/ETFMinded_logo_full.png"
            alt="ETFMinded"
            width={180}
            height={52}
            className="mobile-topbar-logo"
            priority
          />
        </header>
        <main>{children}</main>
      </div>
      <SignedIn>
        <PortfolioChatWidget />
      </SignedIn>
    </div>
  );
}
