import "server-only";

/**
 * The public site's address (origin, no "/" at the end), from the environment only — never written in the code,
 * so each deployment (domain) gives its own:
 *   1. APP_BASE_URL  — your domain, e.g. https://pipibeauty.com (.env locally, Vercel env in production)
 *   2. on Vercel without it: the project's production domain (VERCEL_PROJECT_PRODUCTION_URL, set by Vercel)
 * null when neither is set (pages that know the request can fall back to its address).
 */
export function appUrl(): string | null {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = process.env.APP_BASE_URL || (vercel ? `https://${vercel}` : "");
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}
