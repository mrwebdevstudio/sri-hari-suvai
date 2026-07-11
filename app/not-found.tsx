import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="not-found shell">
      <p className="eyebrow">404 — Page not found</p>
      <h1>This page is not in the catalogue.</h1>
      <p>The address may be incorrect, or the product may not be published.</p>
      <div className="button-row">
        <Link className="button" href="/products">Explore products</Link>
        <Link className="button button--secondary" href="/">Return home</Link>
      </div>
    </div>
  );
}
