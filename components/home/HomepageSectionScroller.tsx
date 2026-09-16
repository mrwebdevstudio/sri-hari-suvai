"use client";

import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 1041px) and (hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const WHEEL_THRESHOLD = 32;
const GESTURE_IDLE_MS = 180;

function getHeaderOffset(): number {
  return document.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect().height ?? 0;
}

function shouldKeepNativeScroll(target: EventTarget | null, direction: number): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('[role="dialog"], [aria-modal="true"], select, textarea, [data-section-scroll-ignore]')) {
    return true;
  }

  let element: Element | null = target;
  while (element && element !== document.body) {
    if (element instanceof HTMLElement) {
      const overflowY = getComputedStyle(element).overflowY;
      const scrollable = /(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (scrollable) {
        const canScrollDown = element.scrollTop + element.clientHeight < element.scrollHeight - 1;
        const canScrollUp = element.scrollTop > 1;
        if ((direction > 0 && canScrollDown) || (direction < 0 && canScrollUp)) return true;
      }
    }
    element = element.parentElement;
  }

  return false;
}

function normalizedDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

export function HomepageSectionScroller({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-home-section], .site-footer"),
    );
    if (sections.length < 2) return;

    document.documentElement.dataset.homeSectionScrolling = "true";

    let accumulatedDelta = 0;
    let lastDirection = 0;
    let lastWheelAt = 0;
    let locked = false;
    let settled = true;
    let unlockTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let settleFrame = 0;

    const clearScheduledWork = () => {
      if (unlockTimer) clearTimeout(unlockTimer);
      if (settleTimer) clearTimeout(settleTimer);
      if (settleFrame) cancelAnimationFrame(settleFrame);
    };

    const scheduleUnlock = () => {
      if (!settled) return;
      const wait = Math.max(0, GESTURE_IDLE_MS - (performance.now() - lastWheelAt));
      if (unlockTimer) clearTimeout(unlockTimer);
      unlockTimer = setTimeout(() => {
        if (performance.now() - lastWheelAt >= GESTURE_IDLE_MS) {
          locked = false;
        } else {
          scheduleUnlock();
        }
      }, wait);
    };

    const waitForSettle = (targetY: number) => {
      settled = false;
      let stableFrames = 0;
      let previousY = window.scrollY;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener("scrollend", finish);
        if (settleTimer) clearTimeout(settleTimer);
        if (settleFrame) cancelAnimationFrame(settleFrame);
        settled = true;
        scheduleUnlock();
      };

      const measure = () => {
        const currentY = window.scrollY;
        const atTarget = Math.abs(currentY - targetY) <= 2;
        stableFrames = atTarget && Math.abs(currentY - previousY) <= 0.5 ? stableFrames + 1 : 0;
        previousY = currentY;
        if (stableFrames >= 4) {
          finish();
          return;
        }
        settleFrame = requestAnimationFrame(measure);
      };

      window.addEventListener("scrollend", finish, { once: true });
      settleTimer = setTimeout(finish, 1800);
      settleFrame = requestAnimationFrame(measure);
    };

    const onWheel = (event: WheelEvent) => {
      if (!desktop.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const delta = normalizedDelta(event);
      if (Math.abs(delta) < 0.5) return;
      const direction = Math.sign(delta);
      if (shouldKeepNativeScroll(event.target, direction)) return;

      lastWheelAt = performance.now();
      if (locked) {
        event.preventDefault();
        scheduleUnlock();
        return;
      }

      const headerOffset = getHeaderOffset();
      const currentIndex = sections.reduce((nearest, section, index) => {
        const distance = Math.abs(section.getBoundingClientRect().top - headerOffset);
        const nearestDistance = Math.abs(sections[nearest].getBoundingClientRect().top - headerOffset);
        return distance < nearestDistance ? index : nearest;
      }, 0);
      const targetIndex = Math.min(sections.length - 1, Math.max(0, currentIndex + direction));

      if (targetIndex === currentIndex) {
        accumulatedDelta = 0;
        return;
      }

      event.preventDefault();
      if (direction !== lastDirection) accumulatedDelta = 0;
      lastDirection = direction;
      accumulatedDelta += delta;
      if (Math.abs(accumulatedDelta) < WHEEL_THRESHOLD) return;

      accumulatedDelta = 0;
      locked = true;
      const target = sections[targetIndex];
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const targetY = Math.min(
        maxScroll,
        Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerOffset),
      );

      window.scrollTo({
        top: targetY,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
      waitForSettle(targetY);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      delete document.documentElement.dataset.homeSectionScrolling;
      clearScheduledWork();
    };
  }, []);

  return <div className="homepage-scroll">{children}</div>;
}
