"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="admin-empty" role="alert"><h1>Admin data could not be loaded.</h1><p>Check the server configuration or try the request again.</p><button className="button" type="button" onClick={reset}>Try again</button></section>;
}
