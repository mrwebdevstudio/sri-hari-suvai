import Image from "next/image";
import Link from "next/link";

import { buildMailtoHref, buildWhatsAppHref } from "@/lib/ordering";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  const whatsappHref = buildWhatsAppHref(siteConfig.whatsappNumber);
  const emailHref = buildMailtoHref(siteConfig.email, "Sri Hari Suvai enquiry");

  return (
    <footer className="site-footer">
      <div className="footer-main shell">
        <div className="footer-brand">
          <Link className="wordmark wordmark--footer" href="/">
            <Image
              className="wordmark-logo"
              src="/brand/sri-hari-suvai-logo.png"
              alt=""
              width={64}
              height={64}
            />
            <span>Sri Hari Suvai</span>
          </Link>
          <p>South Indian food products, presented with clarity and care.</p>
        </div>

        <div>
          <p className="footer-heading">Explore</p>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/products">Products</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/cart">Cart</Link>
            <Link href="/about">Our story</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>

        {(whatsappHref || emailHref) && (
          <div>
            <p className="footer-heading">Get in touch</p>
            <div className="footer-links">
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  WhatsApp enquiry
                </a>
              ) : null}
              {emailHref ? <a href={emailHref}>Email Sri Hari Suvai</a> : null}
            </div>
          </div>
        )}
      </div>
      <div className="footer-bottom shell">
        <p>© {new Date().getFullYear()} Sri Hari Suvai.</p>
      </div>
    </footer>
  );
}
