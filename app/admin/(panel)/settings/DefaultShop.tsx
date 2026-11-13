"use client";

import { Home, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode } from "@/lib/result";
import { setDefaultShop } from "./actions";

/**
 * Super-admin only: show this shop at the app's main address (host/ instead of host/<shop>). Saves right away.
 * `other` = the shop that is the default now (turning this on takes its place).
 */
export function DefaultShop({ isDefault, host, other }: { isDefault: boolean; host: string; other: string | null }) {
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

  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Home className="size-5" aria-hidden />
        {t("defaultTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("defaultHint")}</p>
      <Card className="mt-3 gap-2 p-4 md:p-5">
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="default-shop">{t("defaultLabel", { host })}</Label>
            <p className="text-xs text-muted-foreground">
              {on ? t("defaultOn", { host }) : other ? t("defaultOther", { shop: other }) : t("defaultNone")}
            </p>
          </div>
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          <Switch id="default-shop" checked={on} disabled={pending} onCheckedChange={change} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
      </Card>
    </section>
  );
}
