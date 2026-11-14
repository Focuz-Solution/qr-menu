"use client";

import { ArrowRight, Home, Link2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { setDefaultShop } from "./actions";

/**
 * Super-admin only: show this shop at the app's main address (host/ instead of host/<shop>). Saves right away.
 * `other` = the shop that is the default now (turning this on takes its place).
 * The box under the switch shows where each link goes, so the owner sees the result before/after switching.
 */
export function DefaultShop({ isDefault, host, slug, other }: { isDefault: boolean; host: string; slug: string; other: string | null }) {
  const t = useTranslations("admin.settings");
  const te = useTranslations("errors");
  const [on, setOn] = useState(isDefault);
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setOn(next);
    setError(undefined);
    start(async () => {
      const r = await setDefaultShop(next);
      if (!r.ok) {
        setOn(!next);
        setError(r.error);
      }
    });
  }

  // where host/ leads right now
  const mainGoes = on ? t("defaultThisShop") : (other ?? t("defaultFirstShop"));
  const links = [
    { icon: Home, url: host, goes: mainGoes, mine: on },
    { icon: Link2, url: `${host}/${slug}`, goes: t("defaultThisShop"), mine: true },
  ];

  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Home className="size-5" aria-hidden />
        {t("defaultTitle")}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("defaultOwnerOnly")}</span>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("defaultHint", { host })}</p>
      <Card className="mt-3 gap-4 p-4 md:p-5">
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="default-shop">{t("defaultLabel", { host })}</Label>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {on ? t("defaultOn", { host }) : other ? t("defaultOther", { shop: other }) : t("defaultNone", { host })}
            </p>
          </div>
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          <Switch id="default-shop" checked={on} disabled={pending} onCheckedChange={change} />
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("defaultPreview")}</p>
          <ul className="flex flex-col gap-2 text-sm">
            {links.map(({ icon: Icon, url, goes, mine }) => (
              <li key={url} className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate font-medium">{url}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    mine ? "bg-ok text-ok-foreground" : "bg-background text-muted-foreground",
                  )}
                >
                  {goes}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
      </Card>
    </section>
  );
}
