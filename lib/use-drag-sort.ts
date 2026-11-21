"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** `order` with `id` moved to index `to` (the same array when nothing changes) */
export function moveTo(order: string[], id: string, to: number) {
  const from = order.indexOf(id);
  if (from < 0 || to < 0 || to >= order.length || from === to) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * Drag ⠿ to reorder a list (categories, products, variants): mouse + touch through pointer events.
 *
 * The move / release are listened to on the whole window, not on the handle: when React moves the dragged row
 * to its new place in the page, the browser drops a handle's pointer capture, which made the row stop after one
 * step and stay stuck when let go.
 *
 * - every row carries `attr` (e.g. data-item="<id>")
 * - a row swaps place once the pointer passes the middle of the row it is over (no flicker between rows of
 *   different heights), so where you let go is where it stays
 * - `onDrop(order)` runs on release, only when the order changed; a cancelled pointer (e.g. a phone call) drops it
 * - `onOther`: the pointer is over something that isn't a row (e.g. the pager's ‹ ›) → may return a new order
 * - `onMove`: what is under the pointer on every move (null when the drag ends), e.g. to light up a drop target
 */
export function useDragSort({ attr, onDrop, onOther, onMove }: {
  attr: string;
  onDrop: (order: string[]) => void;
  onOther?: (under: Element | null, id: string, order: string[], time: number) => string[] | null;
  onMove?: (under: Element | null) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; order: string[] } | null>(null);
  // the newest callbacks, for listeners added when the drag started
  const opts = useRef({ attr, onDrop, onOther, onMove });
  useLayoutEffect(() => {
    opts.current = { attr, onDrop, onOther, onMove };
  });
  // listeners of a drag still running (removed on release, or when the list goes away mid-drag)
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  function start(e: React.PointerEvent, id: string, ids: string[]) {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    stop.current?.();
    const pointer = e.pointerId;
    let order = ids;
    setDrag({ id, order });

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      const { attr, onOther, onMove } = opts.current;
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      onMove?.(under);
      const row = under?.closest<HTMLElement>(`[${attr}]`);
      let next = order;
      if (row) {
        const over = row.getAttribute(attr)!;
        const to = order.indexOf(over);
        const from = order.indexOf(id);
        if (over !== id && to >= 0) {
          // only past the middle of that row, in the direction we're going
          const r = row.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if ((to > from && ev.clientY > mid) || (to < from && ev.clientY < mid)) next = moveTo(order, id, to);
        }
      } else if (onOther) {
        next = onOther(under, id, order, ev.timeStamp) ?? order;
      }
      if (next !== order) {
        order = next;
        setDrag({ id, order });
      }
    };
    const end = (save: boolean) => (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      stop.current?.();
      opts.current.onMove?.(null);
      setDrag(null);
      if (save && order.join() !== ids.join()) opts.current.onDrop(order);
    };
    const up = end(true);
    const cancel = end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      stop.current = null;
    };
  }

  return { dragId: drag?.id ?? null, dragOrder: drag?.order ?? null, start };
}
