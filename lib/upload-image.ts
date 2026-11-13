import { compressImage } from "@/lib/compress-image";
import type { ErrorCode } from "@/lib/result";

const MAX_PICK = 30 * 1024 * 1024; // rule 30: any photo up to 30 MB can be picked (it's shrunk before upload)

/**
 * Browser: shrink one photo and send it to /admin/images/ (under /admin so the session cookie is sent) → its address ("/api/images/<id>.webp") and the sizes
 * before/after shrinking (shown as "4.2 MB → 210 KB"), or an error code for `errors` in the messages.
 */
export async function uploadImage(file: File): Promise<{ url: string; before: number; after: number } | { error: ErrorCode }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "badImage" };
  if (file.size > MAX_PICK) return { error: "imageTooLarge" };
  const body = await compressImage(file);
  try {
    const res = await fetch("/admin/images", { method: "POST", body, headers: { "Content-Type": body.type || file.type } });
    const data = await res.json();
    return res.ok ? { url: data.url, before: file.size, after: body.size } : { error: data.error ?? "uploadFailed" };
  } catch {
    return { error: "uploadFailed" };
  }
}
