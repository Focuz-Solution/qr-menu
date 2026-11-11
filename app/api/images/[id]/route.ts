import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { imageStorage } from "@/lib/r2";

export const runtime = "nodejs";

// Serve an uploaded photo from the private R2 bucket. Addresses never change (random id), so browsers + Vercel cache it for a year.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(-thumb)?\.webp$/.exec(id);
  if (!m) return new Response(null, { status: 404 });
  try {
    const { client, bucket } = imageStorage();
    const get = (key: string) => client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(15_000) });
    // photos uploaded before thumbs existed have none → their thumb address serves the full photo
    const object = await get(`images/${id}`).catch((e) => (m[2] && e instanceof NoSuchKey ? get(`images/${m[1]}.webp`) : Promise.reject(e)));
    if (!object.Body) return new Response(null, { status: 404 });
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    return new Response(null, { status: cause instanceof NoSuchKey ? 404 : 503 });
  }
}
