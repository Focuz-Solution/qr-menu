import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { getShopUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { imageObjectKey, imageStorage } from "@/lib/r2";

// Upload one photo (product photo or shop logo) — signed-in owner/staff only. Lives under /admin because the
// session cookie is limited to /admin (lib/auth.ts); photos are served publicly by /api/images/<id>.webp. Same flow as castlykh + plan rules 30–34:
// the browser already shrank it (lib/compress-image.ts); the server checks it, then sharp makes two WebP files
// (upright, metadata/GPS removed): full ≤ 1600 px + thumb ≤ 480 px → private R2 bucket → /api/images/<id>.webp (+ <id>-thumb.webp).
export const runtime = "nodejs";
const MAX_BYTES = 30 * 1024 * 1024; // normally ~200 KB after the browser shrank it; the original only if the browser could not
// error = a key of `errors` in the messages, shown in the admin's language
const error = (code: string, status: number) => Response.json({ error: code }, { status });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("notAllowed", 403);
  // signed in, inside a shop, and allowed to edit the menu (owner / admin / staff)
  const user = await getShopUser();
  if (!user || !hasRole(user.role, ["owner", "staff"])) return error("notAllowed", 401);
  if (!/^image\/(jpeg|png|webp)$/.test(request.headers.get("content-type") ?? "")) return error("badImage", 400);
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return error("imageTooLarge", 413);

  const reader = request.body?.getReader();
  if (!reader) return error("badImage", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return error("imageTooLarge", 413);
      }
      chunks.push(value);
    }
  } catch {
    return error("badImage", 400);
  } finally {
    reader.releaseLock();
  }

  let full: Buffer, thumb: Buffer;
  try {
    const source = sharp(Buffer.concat(chunks), { limitInputPixels: 100_000_000 });
    const { format } = await source.metadata();
    if (!format || !["jpeg", "png", "webp"].includes(format)) return error("badImage", 400);
    const fit = { fit: "inside", withoutEnlargement: true } as const;
    // decode the (possibly large) original once; the thumb is made from the small 1600 px result
    full = await source.rotate().resize(1600, 1600, fit).webp({ quality: 82 }).toBuffer();
    thumb = await sharp(full).resize(480, 480, fit).webp({ quality: 75 }).toBuffer();
  } catch {
    return error("badImage", 400);
  }

  try {
    const { client, bucket } = imageStorage();
    const id = randomUUID();
    const put = (key: string, body: Buffer) =>
      client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp" }), { abortSignal: AbortSignal.timeout(30_000) });
    await Promise.all([put(imageObjectKey(`${id}.webp`), full), put(imageObjectKey(`${id}-thumb.webp`), thumb)]);
    return Response.json({ url: `/api/images/${id}.webp` });
  } catch (cause) {
    // the admin sees a short message; the real reason (missing settings, wrong key, no bucket) goes to the server log
    console.error("[images] upload failed:", cause);
    return error("uploadFailed", 503);
  }
}
