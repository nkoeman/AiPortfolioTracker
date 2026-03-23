import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-brand"
});

export const metadata: Metadata = {
  title: "Chief Capital",
  description: "Chief Capital portfolio intelligence dashboard",
  icons: {
    icon: "/brand/Chief_Capital_icon.png",
    shortcut: "/brand/Chief_Capital_icon.png",
    apple: "/brand/Chief_Capital_icon.png"
  }
};

// Wraps all pages with auth context and top-level navigation.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>
          <AppShell hasSession={Boolean(session)}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
