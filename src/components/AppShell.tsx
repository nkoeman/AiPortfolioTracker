"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";

type AppShellProps = {
  children: React.ReactNode;
};

const PUBLIC_ROUTES = ["/", "/sign-in", "/sign-up", "/login", "/register"];

function getCrumb(pathname: string) {
  if (pathname.startsWith("/app/portfolio")) return "Portfolio";
  if (pathname.startsWith("/app/import")) return "Activity";
  if (pathname.startsWith("/app/insights")) return "Insights";
  return "Performance";
}

function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogOutIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 16l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type ProfileMenuProps = {
  initials: string;
  userName: string;
  userEmail: string;
  variant: "sidebar" | "topbar";
};

function ProfileMenu({ initials, userName, userEmail, variant }: ProfileMenuProps) {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await signOut({ redirectUrl: "/sign-in" });
  }

  const isSidebar = variant === "sidebar";

  return (
    <div ref={rootRef} className={`profile ${isSidebar ? "profile-sidebar" : "profile-topbar"}`}>
      <button
        type="button"
        className={`profile-btn${isSidebar ? " profile-btn-full" : ""}${open ? " open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        <span className={`avatar${isSidebar ? "" : " avatar-sm"}`}>{initials || "U"}</span>
        {isSidebar ? (
          <span className="profile-id">
            <span className="user-name">{userName}</span>
            <span className="user-email">{userEmail}</span>
          </span>
        ) : null}
        <ChevronDownIcon size={14} />
      </button>

      {open ? (
        <div className={`profile-menu${isSidebar ? "" : " down"}`} role="menu">
          <div className="profile-menu-head">
            <span className="avatar">{initials || "U"}</span>
            <div className="profile-id">
              <div className="user-name">{userName}</div>
              <div className="user-email">{userEmail}</div>
            </div>
          </div>
          <div className="profile-menu-sep" />
          <button type="button" className="profile-menu-item danger" role="menuitem" onClick={handleLogout}>
            <LogOutIcon size={15} />
            <span>Log out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const hideShell = useMemo(() => {
    return PUBLIC_ROUTES.some((route) =>
      route === "/sign-in" || route === "/sign-up" ? pathname.startsWith(route) : pathname === route
    );
  }, [pathname]);

  if (hideShell) return <>{children}</>;

  const initials = (user?.fullName || user?.firstName || "U")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const userName = user?.fullName || user?.firstName || "User";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-row">
          <img src="/brand/ETFMinded-mark.svg" alt="" className="brand-mark" aria-hidden="true" />
          <img src="/brand/ETFMinded-wordmark.svg" alt="ETFMinded" className="brand-wordmark" />
        </div>

        <SidebarNav />

        <div className="sidebar-foot">
          <ProfileMenu initials={initials} userName={userName} userEmail={userEmail} variant="sidebar" />
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="crumbs">
            <span>ETFMinded</span>
            <span className="sep">/</span>
            <span className="now">{getCrumb(pathname)}</span>
          </div>
          <div className="mobile-brand-lockup">
            <img src="/brand/ETFMinded-mark.svg" alt="" className="mobile-brand-mark" aria-hidden="true" />
            {pathname === "/app" ? (
              <img src="/brand/ETFMinded-wordmark.svg" alt="ETFMinded" className="mobile-brand-wordmark" />
            ) : (
              <span className="mobile-page-title">{getCrumb(pathname)}</span>
            )}
          </div>
          <div className="topbar-right">
            <ProfileMenu initials={initials} userName={userName} userEmail={userEmail} variant="topbar" />
          </div>
        </header>

        <main>{children}</main>
      </div>

      <MobileTabBar />
    </div>
  );
}
