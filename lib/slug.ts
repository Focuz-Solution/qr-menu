import type { ErrorCode } from "@/lib/result";

/** shown while typing a shop's link address: a whole link (example.com/…, https://…) or characters that aren't allowed */
export function slugLiveError(address: string): ErrorCode | undefined {
  if (/[./:]/.test(address)) return "slugIsLink";
  if (/[^a-z0-9-]/.test(address)) return "badSlug";
}
