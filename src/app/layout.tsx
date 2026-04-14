// ClerkProvider requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at render time.
// That env var is injected at runtime (not baked into the Docker image),
// so static prerendering during build would always fail. Force all pages
// under this layout to render dynamically at request time.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brand"
});

export const metadata: Metadata = {
  title: "ETFMinded",
  description: "ETFMinded portfolio intelligence dashboard",
  icons: {
    icon: "/brand/ETFMinded_logo_only.png",
    shortcut: "/brand/ETFMinded_logo_only.png",
    apple: "/brand/ETFMinded_logo_only.png"
  }
};

// Wraps all pages with auth context and top-level navigation.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
