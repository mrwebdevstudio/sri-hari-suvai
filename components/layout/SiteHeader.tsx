"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef } from "react";
import { CartButton } from "@/components/cart/CartProvider";
import { BrandArrival } from "@/components/layout/BrandArrival";
import { StoreIcon } from "@/components/ui/StoreIcon";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/shop?range=instant", label: "Instant Mix" },
  { href: "/shop?range=direct", label: "Direct Mix" },
  { href: "/about", label: "Our Story" },
];

function NavLinks({ active, close }: { active?: string; close?: () => void }) {
  return navigation.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={active === href ? "page" : undefined} onClick={close}>{label}</Link>
  ));
}

function ActiveLinks({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const range = useSearchParams().get("range");
  return <NavLinks active={pathname === "/shop" && range ? pathname + "?range=" + range : pathname} close={close} />;
}

export function SiteHeader({ shipping }: { shipping?: string }) {
  const menu = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const closeMenu = () => menu.current?.close();

  return (
    <header className="store-header">
      <div className="store-ribbon"><div className="store-shell">
        <Link href={shipping ? "/shop" : "/track-order"}><StoreIcon name="truck" />{shipping || "Track your order"}</Link>
        <span><StoreIcon name="leaf" /> Traditional recipes <i /> South Indian taste</span>
      </div></div>
      <div className="store-bar store-shell">
        <BrandArrival />
        <nav className="store-nav" aria-label="Primary navigation">
          <Suspense fallback={<NavLinks />}><ActiveLinks /></Suspense>
        </nav>
        <div className="store-actions">
          <button aria-label="Search products" aria-haspopup="dialog" onClick={() => search.current?.showModal()}><StoreIcon name="search" /></button>
          <Link href="/account" aria-label="My account"><StoreIcon name="person" /></Link>
          <CartButton />
          <button className="store-menu-toggle" aria-label="Open menu" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}><StoreIcon name="list" /></button>
        </div>
      </div>
      <dialog ref={menu} className="store-dialog store-menu" aria-labelledby="menu-title" onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="dialog-panel">
          <div className="dialog-heading"><h2 id="menu-title">Menu</h2><button aria-label="Close menu" onClick={closeMenu}><StoreIcon name="x-lg" /></button></div>
          <nav aria-label="Mobile navigation">
            <Suspense fallback={<NavLinks close={closeMenu} />}><ActiveLinks close={closeMenu} /></Suspense>
            <Link href="/products" onClick={closeMenu}>All products</Link>
            <Link href="/track-order" onClick={closeMenu}>Track order</Link>
            <Link href="/account" onClick={closeMenu}>My account</Link>
            <Link href="/contact" onClick={closeMenu}>Contact</Link>
          </nav>
        </div>
      </dialog>
      <dialog ref={search} className="store-dialog" aria-labelledby="search-title" onClick={event => { if (event.target === event.currentTarget) search.current?.close(); }}>
        <div className="dialog-panel">
          <div className="dialog-heading"><h2 id="search-title">Search the pantry</h2><button aria-label="Close search" onClick={() => search.current?.close()}><StoreIcon name="x-lg" /></button></div>
          <form action="/products" onSubmit={event => {
            event.preventDefault();
            const query = String(new FormData(event.currentTarget).get("q") || "").trim();
            search.current?.close();
            router.push(query ? "/products?q=" + encodeURIComponent(query) : "/products");
          }}>
            <label htmlFor="header-search">Product name or category</label>
            <div className="dialog-search"><input id="header-search" name="q" type="search" placeholder="Try sambar podi" autoFocus /><button className="button">Search</button></div>
          </form>
        </div>
      </dialog>
    </header>
  );
}
