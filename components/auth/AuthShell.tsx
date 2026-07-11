import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="page-wrap">
      <section className="section section--first shell account-shell">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
          <Link className="text-link" href="/">Back to Sri Hari Suvai <span>→</span></Link>
        </div>
      </section>
    </div>
  );
}

export function AuthMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return <p className={error ? "form-message form-message--error" : "form-message"} role="status">{error || message}</p>;
}
