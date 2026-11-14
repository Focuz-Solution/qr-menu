/** UI languages (next-intl): Khmer default + English */
export const LOCALES = ["km", "en"] as const;
export type Lang = (typeof LOCALES)[number];
export type T = Record<Lang, string>;

/** text in the current language; falls back to Khmer when the English text is missing */
export const pick = (t: T, lang: string) => t[lang as Lang] || t.km;

// size ("100 ml") or shade (hex)
export type Variant = { label: string; hex?: string; price?: number; image?: string; };

/** a category on the shop (from Admin → Menu): its slug is the anchor id, the name is shown as is */
export type ShopCategory = { slug: string; name: string };
/** category slug */
export type Category = string;

export type Product = {
  slug: string;
  name: T;
  brand?: string;
  category: Category;
  price: number;
  oldPrice?: number;
  image: string;
  /** extra photos for the detail-page gallery (main `image` is always first) */
  images?: string[];
  variants?: Variant[];
  description: T;
  howToUse?: T;
  ingredients?: string;
  badges?: ("new" | "sale" | "best")[];
  inStock: boolean;
};

/** defaults until the owner saves Admin → Settings (name, logo) + fixed site config (url, currency) */
/** the app itself (multi-tenant: login page, "Your shops" page) — not a shop */
export const platform = { name: "Focuz Solution", logo: "/logo.png", logoWidth: 250, logoHeight: 132 };

export const shop = {
  name: "Pipi Beauty",
  /** no logo uploaded yet → public/logo.png */
  logo: "/logo.png",
  address: {
    km: "ផ្លូវ ២៧១ ភ្នំពេញ",
    en: "Street 271, Phnom Penh",
  },
  hours: {
    km: "ម៉ោង ៩ ព្រឹក – ៩ យប់ រៀងរាល់ថ្ងៃ",
    en: "Open daily 9:00 – 21:00",
  },
  currency: "USD",
};

/** the variant shown by this photo, if it is one */
export const variantAt = (p: Product, image: string) => p.variants?.find((v) => v.image === image);
/** price of the style picked by its photo: the variant's own price, else the product price (rule 8) */
export const priceAt = (p: Product, image: string) => variantAt(p, image)?.price ?? p.price;
/** the variant shown by this photo: its name, or "" + its number (1, 2…) when it has none; null when the photo isn't a variant */
export function variantName(p: Product, image: string) {
  const list = (p.variants ?? []).filter((v) => v.image);
  const i = list.findIndex((v) => v.image === image);
  return i < 0 ? null : { label: list[i].label, n: i + 1 };
}

export function discountPercent(p: { price: number; oldPrice?: number }) {
  return p.oldPrice && p.oldPrice > p.price
    ? Math.round((1 - p.price / p.oldPrice) * 100)
    : 0;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: shop.currency });
export function formatPrice(n: number) {
  return money.format(n);
}

/** small (480 px) version of an uploaded photo for cards, cart and admin grid; other addresses are returned as is */
export const thumbUrl = (url: string) => url.replace(/^(\/api\/images\/[0-9a-f-]{36})\.webp$/, "$1-thumb.webp");
