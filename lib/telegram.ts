import "server-only";
import { createHash, createHmac, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";
import { appUrl } from "@/lib/app-url";

// Telegram Bot API over plain fetch (no package). One bot for the whole app: TELEGRAM_BOT_TOKEN (env, from @BotFather).
// The token is only in the URL of the request — never logged, never in the database.

export class TelegramError extends Error {
  constructor(
    readonly description: string,
    readonly code?: number,
  ) {
    super(description);
  }
}

/** the bot is set up on the server (TELEGRAM_BOT_TOKEN) */
export const hasBotToken = () => /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "");

/** the bot's number (first part of the token) for checkout's "Connect Telegram" button; null when the bot isn't set up */
export const botId = () => (hasBotToken() ? process.env.TELEGRAM_BOT_TOKEN!.trim().split(":")[0] : null);

// ---- checkout's "Connect Telegram": Log In with Telegram, OpenID Connect (core.telegram.org/bots/telegram-login) ----
// BotFather → bot → Login Widget → Allowed URLs: the site's origin (https://…). Client ID = the bot's number.

const OIDC_ISSUER = "https://oauth.telegram.org";
type Jwk = JsonWebKey & { kid?: string };
let jwks: { keys: Jwk[]; at: number } | null = null;

/** Telegram's public signing keys (cached 1 hour; fetched again when a token names a key we don't have — Telegram rotated) */
async function telegramKey(kid: string | undefined) {
  const find = () => jwks?.keys.find((k) => !kid || k.kid === kid);
  if (!jwks || Date.now() - jwks.at > 3_600_000 || !find()) {
    const res = await fetch(`${OIDC_ISSUER}/.well-known/jwks.json`, { signal: AbortSignal.timeout(10_000) });
    const data = (await res.json().catch(() => null)) as { keys?: Jwk[] } | null;
    if (!res.ok || !Array.isArray(data?.keys)) throw new TelegramError(`JWKS HTTP ${res.status}`, res.status);
    jwks = { keys: data.keys, at: Date.now() };
  }
  const jwk = find();
  return jwk ? createPublicKey({ key: jwk, format: "jwk" }) : null;
}

const b64json = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;

/**
 * Checks the id_token Telegram's login window gave checkout: signed by Telegram (RS256 / ES256), for our bot,
 * not expired, issued in the last 10 minutes. Anything else → null.
 */
export async function verifyTelegramIdToken(idToken: unknown): Promise<TelegramPassUser | null> {
  const clientId = botId();
  if (!clientId || typeof idToken !== "string" || idToken.length > 8192) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = b64json(parts[0]);
    const claims = b64json(parts[1]);
    const alg = header.alg;
    if (alg !== "RS256" && alg !== "ES256") return null;
    const key = await telegramKey(typeof header.kid === "string" ? header.kid : undefined);
    if (!key) return null;
    const ok = verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key, Buffer.from(parts[2], "base64url"));
    if (!ok) return null;
    const now = Date.now() / 1000;
    const aud = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
    if (claims.iss !== OIDC_ISSUER || !aud.includes(clientId) || !(Number(claims.exp) > now) || !(now - Number(claims.iat) < 600)) return null;
    // "id" (profile scope) = the person's Telegram number = their private chat with the bot ("sub" is a different id)
    const id = String(claims.id ?? "");
    if (!/^\d{1,19}$/.test(id)) return null;
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const username = str(claims.preferred_username, 32);
    const photo = str(claims.picture, 500);
    return {
      id,
      name: str(claims.name, 100) || [str(claims.given_name, 50), str(claims.family_name, 50)].filter(Boolean).join(" "),
      username: /^\w{4,32}$/.test(username) ? username : undefined,
      photo_url: photo.startsWith("https://") ? photo : undefined,
    };
  } catch (cause) {
    console.error("[telegram] id_token check failed:", cause);
    return null;
  }
}

/** who connected (shown in checkout) */
export type TelegramPassUser = { id: string; name: string; username?: string; photo_url?: string };
/** what checkout keeps on the phone: the person + when + our signature (so an order can't name someone else's chat) */
export type TelegramPass = TelegramPassUser & { auth_date: number; sig: string };

const passBody = (u: TelegramPassUser, at: number) => JSON.stringify([u.id, u.name, u.username ?? "", u.photo_url ?? "", at]);
const passSig = (body: string) =>
  createHmac("sha256", createHash("sha256").update(`checkout-telegram:${process.env.TELEGRAM_BOT_TOKEN!.trim()}`).digest())
    .update(body)
    .digest("base64url");

/** signs a checked Telegram login for checkout to keep (30 days) */
export function signTelegramPass(u: TelegramPassUser): TelegramPass {
  const auth_date = Math.floor(Date.now() / 1000);
  return { ...u, auth_date, sig: passSig(passBody(u, auth_date)) };
}

/**
 * Checks the pass checkout sent with an order: signed by us (signTelegramPass), at most 30 days old
 * (checkout remembers the connection on the phone that long). Anything else → null (the order is still placed, just not linked).
 */
export function verifyTelegramLogin(data: unknown): { chatId: bigint; name: string | null; username: string | null } | null {
  if (!data || typeof data !== "object" || !hasBotToken()) return null;
  const p = data as Partial<TelegramPass>;
  if (typeof p.id !== "string" || !/^\d{1,19}$/.test(p.id) || typeof p.name !== "string" || typeof p.sig !== "string" || typeof p.auth_date !== "number") return null;
  if ((p.username !== undefined && typeof p.username !== "string") || (p.photo_url !== undefined && typeof p.photo_url !== "string")) return null;
  const expected = Buffer.from(passSig(passBody(p as TelegramPassUser, p.auth_date)));
  if (expected.length !== p.sig.length || !timingSafeEqual(expected, Buffer.from(p.sig))) return null;
  if (!(Date.now() / 1000 - p.auth_date < 30 * 86_400)) return null;
  // a person's private chat with the bot has the same id as the person
  return { chatId: BigInt(p.id), name: p.name.slice(0, 100) || null, username: p.username ? `@${p.username}` : null };
}

export async function telegram<T>(method: string, body: object = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN is not set");
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TelegramError("Could not reach Telegram (network or timeout)");
  }
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string; error_code?: number } | null;
  if (!data?.ok) throw new TelegramError(data?.description ?? `HTTP ${res.status}`, data?.error_code ?? res.status);
  return data.result as T;
}

/** downloads a file the Bot API named (getFile → file_path); the token stays on the server */
export async function telegramFile(path: string) {
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN?.trim()}/${path}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new TelegramError(`HTTP ${res.status}`, res.status);
  return res;
}

let me: Promise<{ id: number; username: string }> | null = null;
/** the bot's own id + @username (asked once per server instance) */
export function botInfo() {
  me ??= telegram<{ id: number; username: string }>("getMe").catch((e) => {
    me = null;
    throw e;
  });
  return me;
}

/** webhook address when the site has a public https address + TELEGRAM_WEBHOOK_SECRET; null → local mode (polling) */
export function webhookUrl() {
  const base = appUrl();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!base || !secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return null;
  const url = new URL("/api/telegram", base);
  return url.protocol === "https:" ? { url: url.href, secret } : null;
}

export const ALLOWED_UPDATES = ["message", "my_chat_member", "callback_query"];

/** Telegram HTML messages: escape & < > in every piece of text we didn't write ourselves (spec §7.2) */
export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type TelegramChat = { id: number; title?: string; type: string; is_forum?: boolean };

export function telegramOrderUrl(id: string) {
  const base = appUrl();
  if (!base) return null;
  try {
    const url = new URL(`/admin/orders/${id}`, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
