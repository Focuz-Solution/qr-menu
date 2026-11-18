import { PROVINCES } from "@/lib/provinces";

// The customer's province guessed from their internet address (Vercel adds x-vercel-ip-country / -region on every request),
// so checkout can pre-select it. A guess only: mobile networks may place provincial users in Phnom Penh, and the customer
// can always change it. No popup, no database, nothing stored. Locally (no Vercel headers) → null.
export async function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country");
  const region = request.headers.get("x-vercel-ip-country-region") ?? "";
  // ISO 3166-2:KH regions are "1"–"25" (KH-12 = Phnom Penh); our NCDD codes are the same numbers, two digits ("12")
  const code = /^\d{1,2}$/.test(region) ? region.padStart(2, "0") : "";
  const province = country === "KH" && PROVINCES.some((p) => p.code === code) ? code : null;
  // per visitor: never cached by the browser or Vercel
  return Response.json({ province }, { headers: { "Cache-Control": "private, no-store" } });
}
