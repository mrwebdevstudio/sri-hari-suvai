import type { ReactNode } from "react";

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminNotice({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <p className={`admin-notice ${error ? "admin-notice--error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>;
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`admin-status admin-status--${value.replaceAll("_", "-")}`}>{value.replaceAll("_", " ")}</span>;
}

export function EmptyAdminState({ title, children }: { title: string; children: ReactNode }) {
  return <section className="admin-empty"><h2>{title}</h2><p>{children}</p></section>;
}
