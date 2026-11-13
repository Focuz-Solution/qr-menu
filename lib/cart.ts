"use client";

import { useSyncExternalStore } from "react";
import { useProducts } from "@/components/MenuProvider";
import type { Product } from "@/lib/shop";

// Cart = { "slug|photo": qty } in localStorage, shared by every component through useSyncExternalStore.
// The photo is the gallery image picked when adding (each photo is a style), so one product can have several lines.
type Cart = Record<string, number>;

export const cartKey = (slug: string, image: string) => `${slug}|${image}`;
// old carts saved just "slug" → main photo; null when the product is gone (deleted/hidden in Admin)
function parseKey(key: string, products: Product[]) {
  const [slug, image] = key.split("|");
  const product = products.find((p) => p.slug === slug);
  return product ? { product, image: image || product.image } : null;
}

// one cart per shop: "cart:<shop address>". The shop layout writes the shop on <html data-shop>, so the default
// shop opened at app.com/ and at app.com/<shop> share one cart.
const storageKey = () => `cart:${document.documentElement.dataset.shop ?? location.pathname.split("/")[1] ?? ""}`;
const EMPTY: Cart = {};
const listeners = new Set<() => void>();
let cache: { raw: string | null; cart: Cart } = { raw: null, cart: EMPTY };

function read(): Cart {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey());
  } catch {}
  if (raw !== cache.raw) {
    let cart: Cart = EMPTY;
    try {
      cart = raw ? JSON.parse(raw) : EMPTY;
    } catch {}
    cart = Object.fromEntries(Object.entries(cart).filter(([, qty]) => qty > 0));
    cache = { raw, cart };
  }
  return cache.cart;
}

export function setQty(key: string, qty: number) {
  const next = { ...read() };
  if (qty > 0) next[key] = qty;
  else delete next[key];
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

/** after an order is sent */
export function clearCart() {
  try {
    localStorage.removeItem(storageKey());
  } catch {}
  listeners.forEach((l) => l());
}

export function addToCart(key: string) {
  setQty(key, (read()[key] ?? 0) + 1);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, read, () => EMPTY);
  const products = useProducts();
  // lines whose product no longer exists are skipped (they stay in storage, harmless)
  const items = Object.entries(cart).flatMap(([key, qty]) => {
    const line = parseKey(key, products);
    return line ? [{ key, ...line, qty }] : [];
  });
  return {
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    total: items.reduce((n, i) => n + i.product.price * i.qty, 0),
  };
}
