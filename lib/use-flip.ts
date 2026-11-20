"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Smoothly slides list rows to their new place when the order changes (drag to reorder):
 * remembers where each row was, and after React moves it, animates it from the old spot to the new one.
 * - `attr`: the data attribute that names each row inside the container, e.g. "data-cat"
 * - `order`: the current order (ids joined), so it only runs when the order changes
 * - `skip`: the row being dragged — it stays under the finger (animating it would make the rows swap back and forth)
 * Put the returned ref on the list's container. Turned off when the device asks for reduced motion.
 */
export function useFlip<T extends HTMLElement>(attr: string, order: string, skip?: string | null) {
  const ref = useRef<T>(null);
  const tops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    // positions are measured from the top of the list, so scrolling the page in between doesn't count as a move
    const origin = root.getBoundingClientRect().top;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const el of root.querySelectorAll<HTMLElement>(`[${attr}]`)) {
      const id = el.getAttribute(attr)!;
      // stop a slide still running, so we measure where the row really is now
      for (const a of el.getAnimations()) if (a.id === "flip") a.cancel();
      const top = el.getBoundingClientRect().top - origin;
      next.set(id, top);
      const before = tops.current.get(id);
      if (calm || id === skip || before === undefined || before === top) continue;
      const slide = el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
        duration: 200,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
      slide.id = "flip";
    }
    tops.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the order changes
  }, [order]);

  return ref;
}
