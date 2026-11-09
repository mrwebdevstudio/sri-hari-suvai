"use client";

import { useEffect, useRef } from "react";
import { Brand } from "@/components/layout/Brand";

export function BrandArrival() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const brand = root.querySelector("a");
    const screen = root.querySelector<HTMLElement>(".brand-curtain");
    if (!brand || !screen) return;

    const events = new AbortController();
    const { signal } = events;
    const finish = () => {
      root.dataset.phase = "done";
      events.abort();
    };

    // The CSS fallback may already have revealed the page on a slow start.
    if (!screen.offsetWidth || getComputedStyle(screen).visibility === "hidden") {
      finish();
      return;
    }

    for (const event of ["pointerdown", "keydown", "wheel", "resize", "pagehide"]) {
      window.addEventListener(event, finish, { once: true, passive: true, signal });
    }
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", finish, { signal });
    brand.addEventListener("animationend", finish, { signal });

    Promise.all(Array.from(brand.querySelectorAll("img"), image => image.decode())).then(() => {
      if (signal.aborted) return;
      const bounds = brand.getBoundingClientRect();
      const x = document.documentElement.clientWidth / 2 - bounds.left - bounds.width / 2;
      const y = window.innerHeight / 2 - bounds.top - bounds.height / 2;
      root.style.setProperty("--arrival-x", x + "px");
      root.style.setProperty("--arrival-y", y + "px");
      root.dataset.phase = "playing";
    }).catch(() => { if (!signal.aborted) finish(); });

    return () => events.abort();
  }, []);

  return (
    <div ref={container} className="brand-arrival" data-phase="waiting">
      <span className="brand-curtain" aria-hidden="true" />
      <Brand eager />
    </div>
  );
}
