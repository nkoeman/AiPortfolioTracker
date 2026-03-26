import Image from "next/image";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthPageShell({ eyebrow, title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="hidden lg:flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <Image
              src="/brand/Chief_Capital_logo.png"
              alt="Chief Capital logo"
              width={281}
              height={64}
              priority
              className="h-auto w-auto max-w-full"
            />
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
              <p className="max-w-md text-base leading-7 text-slate-600">{subtitle}</p>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              Keep your portfolio view unified across positions, exposure, transactions, and performance drivers.
            </p>
          </section>

          <section className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="w-full max-w-md">
              <div className="mb-4 space-y-2 lg:hidden">
                <Image
                  src="/brand/Chief_Capital_logo.png"
                  alt="Chief Capital logo"
                  width={220}
                  height={50}
                  priority
                  className="h-auto w-auto max-w-full"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
              </div>
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
