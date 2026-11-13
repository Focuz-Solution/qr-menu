import { MapPin, Navigation, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { FacebookCircleIcon, TelegramCircleIcon, TikTokIcon } from "@/components/icons";
import { ShopLogo } from "@/components/ShopLogo";
import { cn } from "@/lib/utils";

type Links = { telegram: string | null; facebook: string | null; tiktok: string | null };
type Contact = { phone: string | null; address: string; mapUrl: string | null };


export function Footer({ name, logo, links, contact }: { name: string; logo: string; links: Links; contact: Contact }) {
  const t = useTranslations("footer");
  const icons = [
    { href: links.telegram, label: "Telegram", mark: <TelegramCircleIcon className="size-full text-telegram" /> },
    { href: links.facebook, label: "Facebook", mark: <FacebookCircleIcon className="size-full text-facebook" /> },
    {
      href: links.tiktok,
      label: "TikTok",
      mark: (
        <span className="grid size-full place-items-center rounded-full bg-tiktok text-white">
          <TikTokIcon className="size-[60%]" />
        </span>
      ),
    },
  ];

  // phone (tap to call), address, map link — whichever are set
  const details = [
    contact.phone && (
      <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 hover:text-foreground">
        <Phone className="size-4 shrink-0" aria-hidden />
        <span className="tabular-nums">{contact.phone}</span>
      </a>
    ),
    contact.address && (
      <span className="inline-flex min-h-11 items-center gap-2 text-balance">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {contact.address}
      </span>
    ),
    contact.mapUrl && (
      <a href={contact.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium text-primary hover:underline">
        <Navigation className="size-4 shrink-0" aria-hidden />
        {t("openMap")}
      </a>
    ),
  ].filter(Boolean);

  return (
    <footer className="mt-auto pt-10 pb-6 text-center">
      <div className="mb-6 border-t-2 border-dotted" aria-hidden />
      <ShopLogo src={logo} alt={name} size={64} className="mx-auto mb-4 size-16" />
      {/* shop details from Settings → Shop details: one row split by short "|" lines (stacked on phones); only filled-in ones */}
      {details.length > 0 && (
        <ul className="mx-auto mb-5 flex max-w-3xl flex-col items-center gap-x-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center">
          {details.map((item, i) => (
            <li key={i} className="flex items-center gap-x-4">
              {i > 0 && <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />}
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm text-muted-foreground">{t("contactLabel")}</span>
        {icons.map(({ href, label, mark }) => {
          const look = "relative block size-6 rounded-full after:absolute after:-inset-2.5";
          return href ? (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cn(look, "outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}>
              {mark}
            </a>
          ) : (
            <span key={label} role="link" aria-disabled="true" aria-label={label} className={look}>
              {mark}
            </span>
          );
        })}
      </div>
    </footer>
  );
}
