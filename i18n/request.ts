import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALES } from "@/lib/shop";

export const ADMIN_LANG_COOKIE = "admin_lang";

export default getRequestConfig(async ({ requestLocale }) => {
  // Shop pages pass the shop language (setRequestLocale). Admin pages don't, so the admin reads its own cookie.
  const requested = (await requestLocale) ?? (await cookies()).get(ADMIN_LANG_COOKIE)?.value;
  const locale = hasLocale(LOCALES, requested) ? requested : "km";
  return {
    locale,
    timeZone: "Asia/Phnom_Penh",
    messages: (await import(`../public/messages/${locale}.json`)).default,
  };
});
