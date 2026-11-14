import type { Badge } from "@/lib/generated/prisma/enums";

// What the Menu page sends to the browser (prices in cents).
export type AdminCategory = { id: string; slug: string; name: string; isVisible: boolean };

export type AdminItem = {
  id: string;
  slug: string;
  categoryId: string;
  name: string;
  brand: string | null;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  badge: Badge | null;
  isAvailable: boolean;
  isVisible: boolean;
  image: string | null;
  images: string[];
  /** as saved: price in cents, none = the product price */
  variants: { label: string; image: string; priceCents?: number }[];
};

/** a style of the product (shade, size…): its own photo + name; the photo is also one of the product's image rows */
export type VariantInput = { label: string; image: string; /** own price in dollars as typed, "" = the product price */ price: string };

/** product form as typed by the admin (prices in dollars, empty string = not set) */
export type ItemInput = {
  name: string;
  brand: string;
  categoryId: string;
  price: string;
  /** discount as typed: "10" (% off) or "1.50" ($ off), "" = no discount */
  discount: string;
  /** "percent" | "amount" */
  discountType: string;
  badge: string;
  isAvailable: boolean;
  isVisible: boolean;
  description: string;
  /** main photo ("" = none) */
  image: string;
  variants: VariantInput[];
};
