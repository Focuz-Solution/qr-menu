"use client";

import { createContext, createElement, useContext } from "react";

/**
 * Which shop the page belongs to, set by the shop layout: `slug` = the shop's address name, `base` = where its
 * pages live — "/<slug>" normally, "" for the default shop opened at the app's main address (app.com/).
 */
type ShopPath = { slug: string; base: string };
const ShopPathContext = createContext<ShopPath>({ slug: "", base: "" });

export function ShopPathProvider({ slug, base, children }: ShopPath & { children: React.ReactNode }) {
  return createElement(ShopPathContext.Provider, { value: { slug, base } }, children);
}

/** links inside the shop: useShopPath()("/checkout") → "/pipi-beauty/checkout" (or "/checkout" at the main address); () → the shop's home */
export function useShopPath() {
  const { base } = useContext(ShopPathContext);
  return (path = "") => `${base}${path}` || "/";
}

/** the shop's address name, whichever address the page was opened on (the order is sent to this shop) */
export const useShopSlug = () => useContext(ShopPathContext).slug;
