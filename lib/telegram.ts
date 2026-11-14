import "server-only";
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
