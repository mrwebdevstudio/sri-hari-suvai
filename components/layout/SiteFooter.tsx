import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { StoreIcon } from "@/components/ui/StoreIcon";
import { buildMailtoHref, buildWhatsAppHref } from "@/lib/ordering";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  const whatsapp = buildWhatsAppHref(siteConfig.whatsappNumber);
  const email = buildMailtoHref(siteConfig.email, "Sri Hari Suvai enquiry");
  return (
    <footer className="store-footer">
      <div className="store-shell store-footer-grid">
        <Brand />
        <nav className="footer-explore" aria-labelledby="footer-explore">
          <h2 id="footer-explore">Quick Links</h2>
          <Link href="/products">All products</Link>
          <Link href="/shop?range=instant">Instant Mix</Link>
          <Link href="/shop?range=direct">Direct Mix</Link>
          <Link href="/about">Our story</Link>
        </nav>
        <nav className="footer-contact" aria-labelledby="footer-contact">
          <h2 id="footer-contact">Get in Touch</h2>
          <Link href="/contact"><StoreIcon name="envelope" />Contact us</Link>
          {email && <a href={email}>{siteConfig.email}</a>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp enquiry</a>}
          <small>© {new Date().getFullYear()} Sri Hari Suvai</small>
        </nav>
        <nav className="footer-care" aria-labelledby="footer-care">
          <h2 id="footer-care">Customer Care</h2>
          <div className="footer-actions">
            <Link href="/track-order" aria-label="Track an order"><StoreIcon name="box-seam" />Track order</Link>
            <Link href="/account" aria-label="My account"><StoreIcon name="person" />Account</Link>
            <Link href="/cart" aria-label="Shopping cart"><StoreIcon name="bag" />Cart</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
