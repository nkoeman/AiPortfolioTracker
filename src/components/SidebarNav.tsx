"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Performance" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/import", label: "Transactions" }
];

type SidebarNavProps = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <div className="sidebar-links">
      {LINKS.map((link) => {
        const isActive = link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`sidebar-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
