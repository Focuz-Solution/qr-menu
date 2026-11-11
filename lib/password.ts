import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt (node:crypto, no package) with OWASP's recommended cost: N = 2^17, r = 8, p = 1.
// Stored as "scrypt$N$r$p$salt$key" so the cost can be raised later without breaking old hashes.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** valid-looking hash that matches nothing: checked when the email is unknown, so both cases take the same time */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(KEYLEN).toString("base64")}`;

/** readable random password for new staff / resets (16 chars, ~96 bits) */
export const generatePassword = () => randomBytes(12).toString("base64url");

export const MIN_PASSWORD = 8;
