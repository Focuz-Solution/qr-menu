// Courier choices in the zone form (plain module: used by the server pages and the client form).

export type Courier = { name: string; logo: string | null };

/** ready-made couriers with a logo in public/couriers */
export const COURIER_PRESETS: Courier[] = [
  { name: "J&T Express", logo: "/couriers/jt-express.png" },
  { name: "Vireak Buntham Express", logo: "/couriers/vet-express.png" },
  { name: "Grab", logo: "/couriers/grab.png" },
];

export const isPreset = (name: string) => COURIER_PRESETS.some((p) => p.name === name);

/** couriers the admin added before (saved on a zone, with their uploaded logo): offered again; gone once no zone uses them */
export function savedCouriers(zones: { name: string; isCourier: boolean; courierLogo: string | null }[]): Courier[] {
  const byName = new Map<string, string | null>();
  for (const z of zones) if (z.isCourier && !isPreset(z.name)) byName.set(z.name, byName.get(z.name) ?? z.courierLogo);
  return [...byName].map(([name, logo]) => ({ name, logo }));
}
