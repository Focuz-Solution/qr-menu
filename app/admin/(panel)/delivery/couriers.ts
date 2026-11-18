// Courier choices in the zone form (plain module: used by the server pages and the client form).

export type Courier = { name: string; logo: string | null };

/** ready-made couriers with a logo in public/couriers */
export const COURIER_PRESETS: Courier[] = [
  { name: "J&T Express", logo: "/couriers/jt-express.png" },
  { name: "Vireak Buntham Express", logo: "/couriers/vet-express.png" },
  { name: "Grab", logo: "/couriers/grab.png" },
];

export const isPreset = (name: string) => COURIER_PRESETS.some((p) => p.name === name);

/** couriers the admin added before (saved on a carrier, with their uploaded logo): offered again; gone once no zone uses them */
export function savedCouriers(carriers: { name: string; isCourier: boolean; logo: string | null }[]): Courier[] {
  const byName = new Map<string, string | null>();
  for (const c of carriers) if (c.isCourier && !isPreset(c.name)) byName.set(c.name, byName.get(c.name) ?? c.logo);
  return [...byName].map(([name, logo]) => ({ name, logo }));
}

/** a ready-made courier's logo file (public/couriers), else null */
export const presetLogo = (name: string) => COURIER_PRESETS.find((p) => p.name === name)?.logo ?? null;
