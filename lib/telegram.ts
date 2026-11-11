import "server-only";

// Telegram Bot API over plain fetch (no package). The token is only in the URL of the request — never logged.

export class TelegramError extends Error {
  constructor(
    readonly description: string,
    readonly code?: number,
  ) {
    super(description);
  }
}

export async function telegram<T>(token: string, method: string, body: object = {}): Promise<T> {
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

/** Telegram HTML messages: escape & < > in every piece of text we didn't write ourselves (spec §7.2) */
export const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type TelegramChat = { id: number; title?: string; type: string; is_forum?: boolean };

export function telegramOrderUrl(id: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) return null;
  try {
    const url = new URL(`/admin/orders/${id}/`, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
