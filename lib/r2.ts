import "server-only";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3 API), same setup as castlykh. The bucket stays private: photos are served by /api/images/<id>.webp.
export function imageStorage() {
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 image storage is not configured");
  }
  return {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
  };
}

/** our own photo address → its R2 key ("/api/images/<uuid>.webp" → "images/<uuid>.webp"); anything else → null */
export function imageKey(url: string | null | undefined) {
  const m = url && /^\/api\/images\/([0-9a-f-]{36}\.webp)$/.exec(url);
  return m ? `images/${m[1]}` : null;
}

/** delete a photo we uploaded, full + thumb (ignores other addresses, e.g. the default /image.png); never throws */
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
