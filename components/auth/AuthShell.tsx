import Link from "next/link";
import type { ReactNode } from "react";

import { sanitizeAuthDisplayText } from "@/lib/auth-flow";

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
  const safeError = sanitizeAuthDisplayText(error);
  const safeMessage = sanitizeAuthDisplayText(message);
  if (!safeError && !safeMessage) return null;
  return <p className={safeError ? "form-message form-message--error" : "form-message"} role="status">{safeError || safeMessage}</p>;
}
