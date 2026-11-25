// A product variant's id, used by wholesale only (Admin → Wholesale saves steps per variant id). Variants are saved
// as JSON on the product; each keeps its id while the product is edited (renamed, re-ordered, photo changed), so its
// wholesale steps stay with it. Steps used to be saved under the variant's photo, and a new photo lost them.
// The shop and checkout still pick a variant by its photo (tiersByPhoto below). Products saved before ids existed
// use their place as id ("v0", "v1"…) until their next save, which stores it.

/** the variant's id: the saved one, else its place in the list */
export const variantIdAt = (v: { id?: unknown }, i: number) => (typeof v.id === "string" && v.id ? v.id : `v${i}`);

/**
 * A product's saved wholesale steps (WholesalePrice.tiers) per variant id ("" = the product, when it has no variants).
 * Older saves keyed a variant's steps by its photo: those are read for every variant with that photo. Rows the
 * product no longer has are left out. Values are returned as saved (clean them with cleanTiers).
 */
export function tiersById(raw: unknown, variants: { id?: unknown; image?: string }[]): Record<string, unknown> {
  const saved = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  // own keys only (a key like "constructor" must not find Object's built-ins)
  const get = (k: string) => (Object.hasOwn(saved, k) ? saved[k] : undefined);
  if (!variants.length) return get("") === undefined ? {} : { "": get("") };
  return Object.fromEntries(
    variants.flatMap((v, i) => {
      const id = variantIdAt(v, i);
      const steps = get(id) ?? (v.image ? get(v.image) : undefined);
      return steps === undefined ? [] : [[id, steps]];
    }),
  );
}

/**
 * The same steps keyed the way the shop and checkout look a variant up — by its photo ("" = the product without
 * variants). When variants share a photo, the first one's steps are used (the shop shows that variant for the photo).
 */
export function tiersByPhoto(raw: unknown, variants: { id?: unknown; image?: string }[]): Record<string, unknown> {
  const byId = tiersById(raw, variants);
  if (!variants.length) return byId;
  const out: Record<string, unknown> = {};
  const seen = new Set<string>();
  variants.forEach((v, i) => {
    if (!v.image || seen.has(v.image)) return;
    seen.add(v.image);
    const id = variantIdAt(v, i);
    const steps = Object.hasOwn(byId, id) ? byId[id] : undefined;
    if (steps !== undefined) out[v.image] = steps;
  });
  return out;
}
