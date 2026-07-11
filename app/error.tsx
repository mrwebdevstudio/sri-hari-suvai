"use client";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-wrap"><section className="section shell empty-state" role="alert"><p className="eyebrow">Something went wrong</p><h1>We could not load this page.</h1><p>Try the request again. No payment or order status is changed by this error screen.</p><button className="button" type="button" onClick={reset}>Try again</button></section></div>;
}
