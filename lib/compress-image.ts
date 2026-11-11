// Browser: shrink a photo before upload (plan business rules 30–32) — the original never leaves the phone.
// Longest side ≤ 1600 px, never upscaled, EXIF rotation applied, WebP 0.82 (JPEG 0.85 if the browser can't make WebP);
// still > 1 MB → once more at 0.7. No package: createImageBitmap + canvas.

const MAX_SIDE = 1600;
const MAX_BYTES = 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** the shrunk file, or the original when the browser can't decode it (the server checks and re-encodes anyway) */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let blob = await toBlob(canvas, "image/webp", 0.82);
    // old Safari returns PNG when asked for WebP → JPEG instead
    const type = blob?.type === "image/webp" ? "image/webp" : "image/jpeg";
    if (type === "image/jpeg") blob = await toBlob(canvas, type, 0.85);
    if (blob && blob.size > MAX_BYTES) blob = (await toBlob(canvas, type, 0.7)) ?? blob;
    // never send something bigger than what was picked
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** 4404019 → "4.2 MB", 215040 → "210 KB" */
export function formatBytes(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
