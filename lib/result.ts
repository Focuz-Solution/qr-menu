import type km from "@/public/messages/km.json";

/** an error is a key in public/messages/*.json → errors, so the UI shows it in the admin's language (plan/api.md) */
export type ErrorCode = keyof (typeof km)["errors"];

/** what every server action returns: never throws for user mistakes */
export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: ErrorCode; fields?: Record<string, ErrorCode> };
