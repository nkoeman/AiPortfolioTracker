"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";

const LINKS = [
  { href: "/app", label: "Performance", icon: "performance" as const, hint: "" },
  { href: "/app/portfolio", label: "Portfolio", icon: "portfolio" as const, hint: "" },
  { href: "/app/import", label: "Transactions", icon: "transactions" as const, hint: "" }
];

const INTELLIGENCE_LINKS = [
  { href: "/app/insights", label: "AI insights", icon: "insights" as const, hint: "" }
];

type SidebarNavProps = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allLinks = useMemo(() => [...LINKS, ...INTELLIGENCE_LINKS], []);

  useEffect(() => {
    allLinks.forEach((link) => router.prefetch(link.href));
  }, [allLinks, router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <>
      <div className="nav-section">
        <div className="nav-label">Overview</div>
        {LINKS.map((link) => {
          const isActive = link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
          const isPending = pendingHref === link.href && !isActive;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${isActive ? " active" : ""}${isPending ? " pending" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onMouseEnter={() => router.prefetch(link.href)}
              onTouchStart={() => router.prefetch(link.href)}
              onClick={() => {
                setPendingHref(link.href);
                onNavigate?.();
              }}
            >
              <AppIcon name={link.icon} size={16} />
              <span>{link.label}</span>
              <span className="nav-hint">{link.hint}</span>
            </Link>
          );
        })}
      </div>

      <div className="nav-section">
        <div className="nav-label">Intelligence</div>
        {INTELLIGENCE_LINKS.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const isPending = pendingHref === link.href && !isActive;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${isActive ? " active" : ""}${isPending ? " pending" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onMouseEnter={() => router.prefetch(link.href)}
              onTouchStart={() => router.prefetch(link.href)}
              onClick={() => {
                setPendingHref(link.href);
                onNavigate?.();
              }}
            >
              <AppIcon name={link.icon} size={16} />
              <span>{link.label}</span>
              <span className="nav-hint">{link.hint}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
