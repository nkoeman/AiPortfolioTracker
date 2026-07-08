"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppIcon } from "@/components/icons/AppIcon";

const TABS = [
  { href: "/app", label: "Home", icon: "performance" as const },
  { href: "/app/portfolio", label: "Portfolio", icon: "portfolio" as const },
  { href: "/app/import", label: "Activity", icon: "transactions" as const },
  { href: "/app/insights", label: "Insights", icon: "insights" as const }
];

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    TABS.forEach((tab) => router.prefetch(tab.href));
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav className="mobile-tabbar" aria-label="Mobile primary navigation">
      {TABS.map((tab) => {
        const isActive = tab.href === "/app" ? pathname === "/app" : pathname.startsWith(tab.href);
        const isPending = pendingHref === tab.href && !isActive;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`mobile-tab${isActive ? " active" : ""}${isPending ? " pending" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onTouchStart={() => router.prefetch(tab.href)}
            onMouseEnter={() => router.prefetch(tab.href)}
            onClick={() => setPendingHref(tab.href)}
          >
            <AppIcon name={tab.icon} size={20} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
