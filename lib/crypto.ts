import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts secrets kept in the database (Telegram bot token) with AES-256-GCM (spec §10).
// Key: ENCRYPTION_KEY = 32 random bytes, base64 (make one: openssl rand -base64 32). Losing it = paste the token again.

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new Error("ENCRYPTION_KEY missing or not 32 bytes (base64)");
  return buf;
}

export function hasEncryptionKey() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** "v1:iv:tag:data" (base64 parts) */
export function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(payload: string) {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown encrypted format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
