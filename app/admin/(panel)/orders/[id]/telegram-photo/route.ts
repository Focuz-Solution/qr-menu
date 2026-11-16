import { getShopUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasBotToken, telegram, telegramFile } from "@/lib/telegram";

// The customer's Telegram profile photo for the order page (staff of that shop only). Under /admin so the session
// cookie is sent. 404 = no photo (not linked, no photo, or hidden by their privacy) → the page shows their initials.
export const runtime = "nodejs";
const none = () => new Response(null, { status: 404 });

export async function GET(_request: Request, { params }: RouteContext<"/admin/orders/[id]/telegram-photo">) {
  const user = await getShopUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !hasBotToken()) return none();
  const order = await prisma.order.findFirst({ where: { id, shopId: user.shop.id }, select: { customerChatId: true } });
  if (!order?.customerChatId) return none();
  try {
    // ponytail: asks Telegram on every view (cached 1 day in the browser); store the file_id if it gets slow
    const { photos } = await telegram<{ photos: { file_id: string; width: number }[][] }>("getUserProfilePhotos", { user_id: Number(order.customerChatId), limit: 1 });
    const sizes = photos[0];
    if (!sizes?.length) return none();
    // smallest size that is still sharp in a 48px circle (sizes go small → large)
    const photo = sizes.find((s) => s.width >= 160) ?? sizes[sizes.length - 1];
    const { file_path } = await telegram<{ file_path?: string }>("getFile", { file_id: photo.file_id });
    if (!file_path) return none();
    const res = await telegramFile(file_path);
    return new Response(res.body, {
      // Telegram profile photos are JPEG (the file download itself is sent as octet-stream)
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch {
    return none();
  }
}
