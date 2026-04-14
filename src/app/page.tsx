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
    title: "Performance tracking",
    body: "Monitor your portfolio value, returns, and contribution trends over time."
  },
  {
    title: "Exposure analytics",
    body: "Break down your portfolio by region, development profile, country, and sector."
  },
  {
    title: "DeGiro import + sync",
    body: "Upload your DeGiro CSV and let ETFMinded enrich data with price and FX syncing."
  },
  {
    title: "AI portfolio insights",
    body: "Ask focused questions about drivers, risk concentration, and portfolio changes."
  }
];

const steps = [
  "Upload your DeGiro CSV.",
  "ETFMinded processes and enriches your portfolio data.",
  "Review performance, exposures, and AI-generated insights."
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/ETFMinded_logo_only.png"
              alt="ETFMinded"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <span className="text-base font-semibold tracking-tight">ETFMinded</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
          <div className="max-w-3xl space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Understand your ETF portfolio with clarity
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Track performance, exposure, and portfolio insights in one place. Built for investors using DeGiro and
              focused on practical decision support.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Create account
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How it works</h2>
            <ol className="mt-5 grid gap-3 text-sm leading-6 text-slate-700 sm:text-base">
              {steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 px-6 py-8 text-white shadow-sm sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">Start tracking your ETF portfolio today</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Create your account, import your transactions, and get instant visibility into performance and exposure.
            </p>
            <div className="mt-5">
              <Link
                href="/sign-up"
                className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
