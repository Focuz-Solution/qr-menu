"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/lib/result";
import { slugLiveError } from "@/lib/slug";
import { createShop } from "../actions";

/** "Pipi Beauty" → "pipi-beauty"; Khmer-only names give "" (the owner types the address) */
const toSlug = (name: string) =>
  name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");

/** shop name + link address → the new shop opens on its Settings */
export function NewShopForm({ host }: { host: string }) {
  const t = useTranslations("admin.shops");
  const te = useTranslations("errors");
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // the address follows the name until the owner edits it
  const [slugEdited, setSlugEdited] = useState(false);
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const address = slugEdited ? slug : toSlug(name);
  const liveError = slugLiveError(address);
  const slugError = liveError ?? fields.slug;

  function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (liveError) return; // the error is already on screen (and the field shakes)
    start(async () => {
      const r = await createShop({ name, slug: address });
      if (r.ok) return router.push("/admin/settings"); // the new shop is open → fill in its settings
      setFields(r.fields ?? {});
      setFormError(r.fields ? undefined : r.error);
    });
  }

  return (
    <Card className="p-4 md:p-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-name">{t("name")} <Req /></Label>
          <Input id="shop-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-required aria-invalid={!!fields.name || undefined} placeholder={t("namePlaceholder")} className="h-11" />
          {fields.name && <p className="text-xs text-destructive">{te(fields.name)}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shop-slug">{t("slug")} <Req /></Label>
          <Input
            id="shop-slug"
            value={address}
            onChange={(e) => {
              setSlugEdited(true);
              // kept as typed (only lower-cased), so a pasted link shows an error instead of being silently mangled
              setSlug(e.target.value.toLowerCase().trim());
            }}
            maxLength={40}
            aria-required
            aria-invalid={!!slugError || undefined}
            aria-describedby="shop-slug-hint"
            placeholder={t("slugPlaceholder")}
            className="h-11 font-mono"
          />
          {/* error, or a preview of the link (the example address until one is typed) */}
          <p id="shop-slug-hint" className="text-xs text-muted-foreground">
            {slugError ? <span className="text-destructive">{te(slugError)}</span> : t("slugHint", { link: `${host}/${address || t("slugPlaceholder")}` })}
          </p>
        </div>

        {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("create")}
          {!pending && <ArrowRight aria-hidden />}
        </Button>
      </form>
    </Card>
  );
}
