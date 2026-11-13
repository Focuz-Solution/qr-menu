/** what the checkout page sends (everything is checked again on the server) */
export type CheckoutInput = {
  /** the shop's address (app.com/<shop>/checkout) — the order goes to that shop */
  shop: string;
  /** cart lines: product slug, the photo picked (style), quantity */
  lines: { slug: string; image: string; qty: number }[];
  name: string;
  phone: string;
  provinceCode: string;
  deliveryZoneId: string;
  address: string;
  landmark: string;
  mapUrl: string;
  note: string;
  payment: "cod" | "bank_transfer";
  /** one per "Send order" attempt: a double tap gives the same order, not two */
  key: string;
};
