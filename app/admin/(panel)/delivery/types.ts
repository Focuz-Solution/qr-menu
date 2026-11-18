import type { DeliveryOption } from "@/lib/orders";

// What the Delivery pages send to the browser (money in cents).

/** one carrier in a zone (Shop delivery, Grab…) with its price rules */
export type AdminCarrier = DeliveryOption;

export type AdminZone = {
  id: string;
  /** the area's name, e.g. "Phnom Penh" */
  name: string;
  /** empty = everywhere else (fallback zone) */
  provinceCodes: string[];
  isActive: boolean;
  carriers: AdminCarrier[];
};

/** a price step as typed: from this order amount, this fee (dollars, "0" = free) */
export type StepInput = { from: string; fee: string };

/** a carrier as typed by the owner (money in dollars) */
export type CarrierInput = {
  name: string;
  isCourier: boolean;
  /** uploaded logo of an added courier ("" = none) */
  logo: string;
  eta: string;
  fee: string;
  steps: StepInput[];
  payDriver: boolean;
};

/** zone form as typed by the owner */
export type ZoneInput = {
  name: string;
  provinceCodes: string[];
  isActive: boolean;
  carriers: CarrierInput[];
};
