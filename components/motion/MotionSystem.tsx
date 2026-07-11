"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const revealSelector = [
  ".page-hero",
  ".shop-hero-inner",
  ".introduction > .eyebrow",
  ".intro-grid",
  ".section-heading",
  ".journey-intro",
  ".journey-list > li",
  ".principle-grid > article",
  ".closing-cta-inner",
  ".product-grid > .product-card",
  ".category-overview > .category-card",
  ".catalogue-toolbar",
  ".shop-toolbar",
  ".shop-grid > .shop-product-card",
  ".product-detail-media",
  ".product-detail-copy",
  ".cart-page-layout",
  ".checkout-layout",
  ".auth-card",
  ".account-panel",
  ".order-timeline > li",
  ".admin-main > *",
].join(",");

export function MotionSystem() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const main = document.querySelector<HTMLElement>("#main-content");
    if (!main) return;

    main.classList.remove("route-enter");
    if (!reducedMotion) {
      requestAnimationFrame(() => main.classList.add("route-enter"));
    }

    const elements = Array.from(main.querySelectorAll<HTMLElement>(revealSelector));
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.dataset.motionReady = "false";
        element.dataset.revealed = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          element.dataset.revealed = "true";
          observer.unobserve(element);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isInitiallyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
      element.dataset.motionReady = "true";
      element.dataset.revealed = isInitiallyVisible ? "true" : "false";
      if (!isInitiallyVisible) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
