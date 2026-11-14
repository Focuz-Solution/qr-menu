import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type Update } from "@/lib/telegram-bot";

// Telegram webhook (set by the Connect button in Admin → Telegram). Only Telegram knows the secret header.
export async function POST(request: Request) {
  const expected = Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET ?? "");
  const supplied = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  if (!expected.length || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return new Response(null, { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  if (update && typeof update === "object") {
    // always answer 200: otherwise Telegram re-sends the same update again and again
    await handleUpdate(update).catch((e) => console.error("[telegram] update failed:", e));
  }
  return new Response(null, { status: 200 });
}
