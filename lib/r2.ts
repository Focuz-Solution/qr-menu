import "server-only";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3 API), same setup as castlykh. The bucket stays private: photos are served by /api/images/<id>.webp.
// One client per server instance, made on first use and reused by every request (it keeps its connections open).
let storage: { bucket: string; client: S3Client } | undefined;

export function imageStorage() {
  if (storage) return storage;
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 image storage is not configured");
  }
  storage = {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
  };
  return storage;
}

/** R2 folder for photos, from R2_FOLDER (e.g. "qr-menu/images"); slashes at the ends are ignored; default "images" */
export function imageFolder() {
  return (process.env.R2_FOLDER ?? "").trim().replace(/^\/+|\/+$/g, "") || "images";
}

/** file name → its R2 key inside the photo folder ("<uuid>.webp" → "<folder>/<uuid>.webp") */
export const imageObjectKey = (name: string) => `${imageFolder()}/${name}`;

/** our own photo address → its R2 key ("/api/images/<uuid>.webp" → "<folder>/<uuid>.webp"); anything else → null */
export function imageKey(url: string | null | undefined) {
  const m = url && /^\/api\/images\/([0-9a-f-]{36}\.webp)$/.exec(url);
  return m ? imageObjectKey(m[1]) : null;
}

export async function deleteImage(url: string | null | undefined) {
  const key = imageKey(url);
  if (!key) return;
  try {
    const { client, bucket } = imageStorage();
    const del = (k: string) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }), { abortSignal: AbortSignal.timeout(15_000) });
    await Promise.all([del(key), del(key.replace(/\.webp$/, "-thumb.webp"))]);
  } catch (cause) {
    console.error("[images] delete failed:", cause); // ponytail: an orphan file only costs storage
  }
}
