// What the Delivery page sends to the browser (money in cents).
export type AdminZone = {
  id: string;
  name: string;
  /** empty = everywhere else (fallback zone) */
  provinceCodes: string[];
  feeCents: number;
  freeOverCents: number | null;
  isCourier: boolean;
  courierLogo: string | null;
  eta: string;
  isActive: boolean;
};

/** zone form as typed by the owner (money in dollars, empty string = not set) */
export type ZoneInput = {
  name: string;
  provinceCodes: string[];
  fee: string;
  freeOver: string;
  isCourier: boolean;
  /** uploaded logo of an added courier ("" = none) */
  courierLogo: string;
  eta: string;
  isActive: boolean;
};
