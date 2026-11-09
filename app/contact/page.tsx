import type { Metadata } from "next";
import Link from "next/link";

import { buildMailtoHref, buildWhatsAppHref } from "@/lib/ordering";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Sri Hari Suvai for product and order enquiries.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | Sri Hari Suvai",
    description: "Get in touch with Sri Hari Suvai for product and order enquiries.",
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
        <h1>Get in touch</h1>
        <p>
          Get in touch for questions about our products or an existing order.
        </p>
      </header>

      <section className="section section--first shell" aria-labelledby="contact-options-heading">
        <div className="contact-layout">
          <div>
            <p className="eyebrow">Enquiries</p>
            <h2 id="contact-options-heading">How can we help?</h2>
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
                Our contact details will be available here soon. If you have an order number, you can <Link className="text-link" href="/track-order">track your order</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
