import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ETFMinded | ETF Portfolio Tracking & Analytics",
  description:
    "Track ETF portfolio performance, analyze exposure by region and sector, import DeGiro transactions, and get AI-powered insights with ETFMinded."
};

const features = [
  {
    title: "Track portfolio performance",
    body: "Monitor portfolio value, return, and top movers with clean timeframe views."
  },
  {
    title: "Understand exposure",
    body: "Analyze region, development, country, and sector exposure in one portfolio view."
  },
  {
    title: "Import DeGiro and sync data",
    body: "Upload your full DeGiro CSV repeatedly. New rows import, duplicates are ignored."
  },
  {
    title: "Get AI portfolio insights",
    body: "Ask focused portfolio questions and get descriptive analysis grounded in your synced data."
  }
];

const steps = [
  "Upload your DeGiro CSV.",
  "ETFMinded processes and enriches your portfolio data.",
  "Review performance, exposures, transactions, and insights."
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/brand/ETFMinded_logo_only.png" alt="ETFMinded" width={36} height={36} className="rounded-md border border-border" priority />
            <span className="font-display text-base font-semibold tracking-tight">ETFMinded</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="btn btn-sm">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn btn-sm btn-primary">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
          <div className="max-w-3xl space-y-5">
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Understand your ETF portfolio with clarity
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Track performance, exposure, and portfolio insights in one place. Built for investors using DeGiro and
              focused on practical decision support.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href="/sign-up" className="btn btn-primary">
                Create account
              </Link>
              <Link href="/sign-in" className="btn">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="card">
                <h2 className="font-display text-base font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="card">
            <h2 className="font-display text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-5 grid gap-3 text-sm leading-6 text-text-2 sm:text-base">
              {steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
          <div className="rounded-2xl border border-border bg-surface px-6 py-8 shadow-soft sm:px-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Start tracking your ETF portfolio today</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Create your account, import your transactions, and get instant visibility into performance and exposure.
            </p>
            <div className="mt-5">
              <Link href="/sign-up" className="btn btn-primary">
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
