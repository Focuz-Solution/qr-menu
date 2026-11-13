// Shop settings form as typed by the owner (money in dollars, empty string = not set).
export type ShopInput = {
  name: string;
  /** the shop's link address (app.com/<slug>/); can change only until the shop's first order */
  slug: string;
  contactPhone: string;
  telegramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  address: string;
  /** Google Maps link of the shop's location, "" = not set */
  mapUrl: string;
  orderPrefix: string;
  /** "#rrggbb", "" = default theme */
  brandColor: string;
  /** uploaded logo address ("/api/images/<id>.webp"), "" = default logo */
  logoUrl: string;
  /** shop language: "km" | "en" */
  language: string;
  /** home page template: "scroll" | "filter" */
  layout: string;
  /** running text in the shop header */
  notice: string;
};
