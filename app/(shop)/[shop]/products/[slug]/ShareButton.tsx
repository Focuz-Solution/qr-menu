"use client";

import { Check, Link2, MoreHorizontal, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FacebookIcon, TelegramIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Share menu: Facebook / Telegram open their share page with this product's link; Copy link copies it (✓ on the button).
// "More…" opens the phone's native share sheet (only shown where the browser supports it).
type Labels = { share: string; more: string; copy: string; copied: string };

export function ShareButton({ title, labels }: { title: string; labels: Labels }) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only check after mount
  useEffect(() => setCanNativeShare(typeof navigator.share === "function"), []);

  function open(make: (url: string, text: string) => string) {
    const url = encodeURIComponent(window.location.href);
    window.open(make(url, encodeURIComponent(title)), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return; // clipboard blocked (e.g. non-https)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const apps = [
    { name: "Facebook", icon: FacebookIcon, color: "text-facebook", href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: "Telegram", icon: TelegramIcon, color: "text-telegram", href: (u: string, t: string) => `https://t.me/share/url?url=${u}&text=${t}` },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full bg-background hover:bg-background/90"
          aria-label={copied ? labels.copied : labels.share}
          title={copied ? labels.copied : labels.share}
        >
          {copied ? <Check className="size-4 text-primary" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
          <span className="sr-only" aria-live="polite">
            {copied ? labels.copied : ""}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {apps.map(({ name, icon: Icon, color, href }) => (
          <DropdownMenuItem key={name} className="h-10 gap-3" onSelect={() => open(href)}>
            <Icon className={cn("size-5", color)} />
            {name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem className="h-10 gap-3" onSelect={copyLink}>
          <Link2 className="size-5" aria-hidden />
          {labels.copy}
        </DropdownMenuItem>
        {canNativeShare && (
          <DropdownMenuItem
            className="h-10 gap-3"
            onSelect={() => navigator.share({ title, url: window.location.href }).catch(() => {})}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            {labels.more}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
