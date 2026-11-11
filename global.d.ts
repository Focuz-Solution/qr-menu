import type { LOCALES } from "@/lib/shop";
import type messages from "@/public/messages/km.json";

// Type-checked message keys and locales for next-intl
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof LOCALES)[number];
    Messages: typeof messages;
  }
}
