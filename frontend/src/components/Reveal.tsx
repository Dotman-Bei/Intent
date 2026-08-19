"use client";

import { useEffect } from "react";

/**
 * Reveal-on-scroll, handled once at the page level rather than per component: everything marked
 * `.rv` fades up when it enters the viewport, with a 3-wide stagger so rows of cards cascade.
 * Accessibility is handled here too — reduced motion (or a browser without IntersectionObserver)
 * marks everything visible immediately instead of animating.
 */
export function Reveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if (nodes.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      nodes.forEach((node) => node.classList.add("on"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target as HTMLElement;
          const index = nodes.indexOf(node);
          node.style.transitionDelay = `${Math.min(index % 3, 2) * 50}ms`;
          node.classList.add("on");
          observer.unobserve(node);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return null;
}
