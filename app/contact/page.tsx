import type { Metadata } from "next";

import { buildMailtoHref, buildWhatsAppHref } from "@/lib/ordering";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Sri Hari Suvai through a configured enquiry channel.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | Sri Hari Suvai",
    description: "Contact Sri Hari Suvai through a configured enquiry channel.",
    url: "/contact",
  },
};

export default function ContactPage() {
  const whatsappHref = buildWhatsAppHref(siteConfig.whatsappNumber);
  const emailHref = buildMailtoHref(siteConfig.email, "Sri Hari Suvai enquiry");
  const hasContact = Boolean(whatsappHref || emailHref);

  return (
    <div className="page-wrap contact-page">
      <header className="page-hero shell">
        <p className="eyebrow">Contact</p>
        <h1>A direct line, when you need one.</h1>
        <p>
          Use an approved contact channel below. No form collects your details or pretends to send without a working backend.
        </p>
      </header>

      <section className="section section--first shell" aria-labelledby="contact-options-heading">
        <div className="contact-layout">
          <div>
            <p className="eyebrow">Enquiries</p>
            <h2 id="contact-options-heading">Choose a configured channel.</h2>
          </div>
          {hasContact ? (
            <div className="contact-options">
              {whatsappHref ? (
                <a className="contact-card" href={whatsappHref} target="_blank" rel="noreferrer">
                  <span className="eyebrow">WhatsApp</span>
                  <strong>Start an enquiry</strong>
                  <span>Opens WhatsApp with a prepared message. <b aria-hidden="true">→</b></span>
                </a>
              ) : null}
              {emailHref ? (
                <a className="contact-card" href={emailHref}>
                  <span className="eyebrow">Email</span>
                  <strong>{siteConfig.email}</strong>
                  <span>Opens your email application. <b aria-hidden="true">→</b></span>
                </a>
              ) : null}
            </div>
          ) : (
            <div className="empty-state empty-state--compact" role="status">
              <h2>Contact details are not published yet.</h2>
              <p>
                Add an approved WhatsApp number or business email through the documented environment values to enable enquiries.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
