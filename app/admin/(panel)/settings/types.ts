// Shop settings form as typed by the owner (money in dollars, empty string = not set).
export type ShopInput = {
  name: string;
  contactPhone: string;
  telegramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  address: string;
  orderPrefix: string;
  /** "#rrggbb", "" = default theme */
  brandColor: string;
  /** uploaded logo address ("/api/images/<id>.webp"), "" = default logo */
  logoUrl: string;
  /** shop language: "km" | "en" */
  language: string;
  /** running text in the shop header */
  notice: string;
};
