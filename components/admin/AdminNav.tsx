"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const items = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/inventory", "Inventory"],
  ["/admin/analytics", "Analytics"],
  ["/admin/settings", "Store settings"],
  ["/admin/audit-logs", "Audit logs"],
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable?.[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const nav = (
    <nav className="admin-nav-links" aria-label="Admin navigation">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>
      ))}
    </nav>
  );

  return (
    <>
      <button ref={trigger} className="admin-menu-button" type="button" aria-expanded={open} aria-controls="admin-mobile-nav" onClick={() => setOpen(true)}>Menu</button>
      <aside className="admin-sidebar">{nav}</aside>
      {open ? (
        <div className="admin-nav-scrim" onMouseDown={() => setOpen(false)}>
          <aside ref={panel} id="admin-mobile-nav" className="admin-mobile-nav" role="dialog" aria-modal="true" aria-label="Admin menu" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-mobile-nav-head"><strong>Admin menu</strong><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Close</button></div>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
