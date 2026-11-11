"use client";

import { createContext, useContext } from "react";
import type { Product } from "@/lib/shop";

// The shop's products from the database, handed down once by the shop layout (cart, product page, QR page read it).
const MenuContext = createContext<Product[]>([]);

export function MenuProvider({ products, children }: { products: Product[]; children: React.ReactNode }) {
  return <MenuContext.Provider value={products}>{children}</MenuContext.Provider>;
}

export const useProducts = () => useContext(MenuContext);
