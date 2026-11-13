"use client";

import { useParams } from "next/navigation";

/** links inside the shop in the address: useShopPath()("/checkout") → "/pipi-beauty/checkout"; () → the shop's home */
export function useShopPath() {
  const { shop } = useParams<{ shop: string }>();
  return (path = "") => `/${shop}${path}`;
}
