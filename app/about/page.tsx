import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our story",
  description: "The grounded product philosophy behind the Sri Hari Suvai website.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Our story | Sri Hari Suvai",
    description: "The grounded product philosophy behind the Sri Hari Suvai website.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <div className="page-wrap">
      <header className="story-hero shell">
        <div>
          <p className="eyebrow">Our story</p>
          <h1>A product story without invented history.</h1>
        </div>
        <p className="lead">
          Sri Hari Suvai is presented here as a focused South Indian food-products brand.
          Detailed history, manufacturing claims and milestones remain absent until approved.
        </p>
      </header>

      <section className="story-band">
        <div className="shell story-band-grid">
          <p className="story-quote">
            Good product storytelling starts with what can be shown clearly—and stops before assumption becomes claim.
          </p>
          <div className="story-notes">
            <div>
              <span>01</span>
              <h2>Flavour first</h2>
              <p>The visual language draws from South Indian kitchens while keeping the products central.</p>
            </div>
            <div>
              <span>02</span>
              <h2>Facts in context</h2>
              <p>Approved ingredients, usage and pack details sit close to the product they describe.</p>
            </div>
            <div>
              <span>03</span>
              <h2>A direct next step</h2>
              <p>Configured enquiry channels replace dead forms or unsupported commerce promises.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell story-closing" aria-labelledby="story-closing-heading">
        <p className="eyebrow">The catalogue</p>
        <h2 id="story-closing-heading">Let the products carry the story.</h2>
        <p>
          Product pages are ready to grow from approved names, imagery and detail without changing the underlying experience.
        </p>
        <Link className="button" href="/products">Explore products</Link>
      </section>
    </div>
  );
}
