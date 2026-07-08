import Image from "next/image";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthPageShell({ eyebrow, title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="auth-grid">
          <section className="auth-copy">
            <Image
              src="/brand/ETFMinded_logo_full.png"
              alt="ETFMinded logo"
              width={281}
              height={64}
              priority
              className="auth-logo"
            />
            <div className="stack">
              <p className="section-title">{eyebrow}</p>
              <h1 className="page-title">{title}</h1>
              <p className="page-sub">{subtitle}</p>
            </div>
            <p className="page-sub">
              Keep your portfolio view unified across positions, exposure, transactions, and performance drivers.
            </p>
          </section>

          <section className="auth-form-shell">
            <div className="auth-form-inner">
              <div className="auth-mobile-intro">
                <Image
                  src="/brand/ETFMinded_logo_full.png"
                  alt="ETFMinded logo"
                  width={220}
                  height={50}
                  priority
                  className="auth-logo"
                />
                <p className="section-title">{eyebrow}</p>
                <h1 className="card-title" style={{ fontSize: "1.5rem" }}>
                  {title}
                </h1>
                <p className="page-sub">{subtitle}</p>
              </div>
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
