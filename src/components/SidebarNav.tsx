"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Performance" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/import", label: "Transactions" }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="sidebar-links">
      {LINKS.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`sidebar-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
