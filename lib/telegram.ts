import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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

/**
 * Checks what checkout's "Connect Telegram" (Telegram Login, core.telegram.org/widgets/login#checking-authorization) sent:
 * signed by Telegram with our bot token, at most 30 days old (checkout remembers the connection on the phone that long).
 * Anything else → null (the order is still placed, just not linked).
 */
export function verifyTelegramLogin(data: unknown): { chatId: bigint; name: string | null; username: string | null } | null {
  if (!data || typeof data !== "object" || !hasBotToken()) return null;
  const { hash, ...fields } = data as Record<string, unknown>;
  const entries = Object.entries(fields);
  if (typeof hash !== "string" || entries.length > 10 || !entries.every(([, v]) => typeof v === "string" || typeof v === "number")) return null;
  const check = entries
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHash("sha256").update(process.env.TELEGRAM_BOT_TOKEN!.trim()).digest();
  const expected = Buffer.from(createHmac("sha256", secret).update(check).digest("hex"));
  if (expected.length !== hash.length || !timingSafeEqual(expected, Buffer.from(hash))) return null;
  if (!(Date.now() / 1000 - Number(fields.auth_date) < 30 * 86_400) || !/^\d{1,19}$/.test(String(fields.id))) return null;
  const name = [fields.first_name, fields.last_name].filter(Boolean).join(" ").trim().slice(0, 100) || null;
  const username = typeof fields.username === "string" && /^\w{4,32}$/.test(fields.username) ? `@${fields.username}` : null;
  // a person's private chat with the bot has the same id as the person
  return { chatId: BigInt(String(fields.id)), name, username };
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
