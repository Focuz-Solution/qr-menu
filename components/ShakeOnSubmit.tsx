"use client";

import { useEffect } from "react";

/**
 * Pressing submit again while a field still has its error: replay the field's shake (globals.css → [aria-invalid]).
 * CSS alone only shakes when the error first appears. One listener for every form on the page; renders nothing.
 */
export function ShakeOnSubmit() {
  useEffect(() => {
    const onSubmit = (e: Event) => {
      for (const el of (e.target as HTMLElement).querySelectorAll<HTMLElement>('[aria-invalid="true"]')) {
        el.style.animation = "none";
        void el.offsetWidth; // let the browser drop the old run, so the next line starts it again
        el.style.animation = "";
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
