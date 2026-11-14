import { normalizePhone } from "@/lib/orders";

// Accounts sign in with a phone number (most people in Cambodia) or an email — one field for both.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** what someone typed → { email } (has "@") or { phone: "+855…" }; null when it's neither */
export function parseContact(raw: string): { email: string } | { phone: string } | null {
  const value = raw.trim().slice(0, 254);
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.test(email) ? { email } : null;
  }
  // a phone is only digits and the usual separators ("abc012345678" is not a phone)
  if (/[^\d\s+().-]/.test(value)) return null;
  // "+855 012 345 678": people often keep the 0 after the country code — drop it
  const phone = normalizePhone(value.replace(/^(\+?\s*855[\s.-]*)0/, "$1"));
  return phone ? { phone } : null;
}

/** "+85512345678" → "012 345 678" (as people write it in Cambodia) */
export function formatPhone(phone: string) {
  const local = phone.startsWith("+855") ? phone.slice(4) : phone;
  return `0${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

/** what to show for an account: its email, else its phone */
export const contactOf = (user: { email: string | null; phone: string | null }) =>
  user.email ?? (user.phone ? formatPhone(user.phone) : "");
