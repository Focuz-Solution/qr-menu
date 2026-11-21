// Which Cambodian province a GPS point is in — worked out on the phone, the location is never sent anywhere.
// Borders: lib/province-borders.json = geoBoundaries KHM ADM1 (gbOpen, CC BY 4.0, www.geoboundaries.org), simplified
// to ~300 m; per NCDD code (same as PROVINCES), a list of rings as flat [lng, lat, lng, lat, …] in thousandths of a
// degree. A province may have several rings (islands) and a hole (Kandal around Phnom Penh): even-odd counting.

type Borders = Record<string, number[][]>;
let borders: Promise<Borders> | undefined;
// the borders (~70 KB) load the first time someone uses their location, not with the checkout page
const load = () => (borders ??= import("./province-borders.json").then((m) => m.default as unknown as Borders));

/** is point (x, y) inside this ring? (ray casting) */
function inside(x: number, y: number, ring: number[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** how far a point may sit outside every border and still count (beach, river bank, simplified edge): ~3 km */
const NEAR = 27; // thousandths of a degree

/** the province (NCDD code, e.g. "12" = Phnom Penh) at this point, or null when it isn't in Cambodia */
export async function provinceAt(lat: number, lng: number): Promise<string | null> {
  const all = await load();
  const x = lng * 1000;
  const y = lat * 1000;
  for (const [code, rings] of Object.entries(all)) {
    if (rings.filter((r) => inside(x, y, r)).length % 2) return code;
  }
  // just outside: the province with the nearest border point, if close enough
  let best: string | null = null;
  let bestDist = NEAR * NEAR;
  for (const [code, rings] of Object.entries(all)) {
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) {
        const d = (r[i] - x) ** 2 + (r[i + 1] - y) ** 2;
        if (d < bestDist) [best, bestDist] = [code, d];
      }
    }
  }
  return best;
}
