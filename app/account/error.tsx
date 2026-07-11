"use client";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="account-panel" role="alert"><p className="eyebrow">Account unavailable</p><h2>Your private account data could not be loaded.</h2><p>Check the connection and try again.</p><button className="button" type="button" onClick={reset}>Try again</button></section>;
}
