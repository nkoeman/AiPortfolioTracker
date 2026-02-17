"use client";

import { SessionProvider } from "next-auth/react";

// Injects NextAuth session context into the client component tree.
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}