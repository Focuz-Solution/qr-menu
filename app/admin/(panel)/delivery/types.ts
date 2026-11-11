// What the Delivery page sends to the browser (money in cents).
export type AdminZone = {
  id: string;
  name: string;
  /** empty = everywhere else (fallback zone) */
  provinceCodes: string[];
  feeCents: number;
  freeOverCents: number | null;
  eta: string;
  isActive: boolean;
};

/** zone form as typed by the owner (money in dollars, empty string = not set) */
export type ZoneInput = {
  name: string;
  provinceCodes: string[];
  fee: string;
  freeOver: string;
  eta: string;
  isActive: boolean;
};
