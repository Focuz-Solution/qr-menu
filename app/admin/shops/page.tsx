import { ChevronRight, Plus, Store } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShopLogo } from "@/components/ShopLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { enterShop, requireLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFirstShop } from "@/lib/shops";
import { cn } from "@/lib/utils";
import { openShop } from "./actions";
import { OpenShopButton } from "./OpenShopButton";

// "Your shops": the owner (all shops) or someone in several shops picks the shop to work in.
export default async function ShopsPage() {
  const user = await requireLogin();
  const t = await getTranslations("admin.shops");
  const shops = await prisma.shop.findMany({
    where: user.isOwner ? {} : { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, settings: { select: { name: true, logoUrl: true, orderingEnabled: true } } },
  });
  // owner with no shop yet: no empty list — make the first shop and fill in its name + logo in Settings
  if (user.isOwner && !shops.length) {
    const { id } = await createFirstShop(t("defaultName"));
    await enterShop(id);
    redirect("/admin/settings");
  }

  return (
    <>
      {/* top bar: layout.tsx */}
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        {user.isOwner && (
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link href="/admin/shops/new">
              <Plus aria-hidden />
              {t("newShop")}
            </Link>
          </Button>
        )}
      </div>

      {shops.length === 0 ? (
        // not in any shop yet (staff / admin): wait to be added (the owner never gets here — see above)
        <Card className="items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Store className="size-6" aria-hidden />
          </span>
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyMember")}</p>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y">
            {shops.map((s) => {
              const name = s.settings?.name ?? s.slug;
              const on = s.settings?.orderingEnabled ?? true;
              return (
                <li key={s.id}>
                  {/* whole row = open this shop */}
                  <form action={openShop.bind(null, s.id)}>
                    <OpenShopButton
                      name={name}
                      aria-label={t("open", { name })}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      <ShopLogo src={s.settings?.logoUrl ?? ""} alt="" size={40} className="size-10" />
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate font-medium">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">/{s.slug}</span>
                      </span>
                      {/* status pill (admin pattern): green = taking orders, grey = ordering turned off */}
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                          on ? "bg-ok text-ok-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {/* active: the dot pulses (a ring grows and fades, on a loop) — "live"; still when motion is reduced */}
                        <span className="relative flex size-1.5" aria-hidden>
                          {on && <span className="absolute inset-0 animate-ping rounded-full bg-ok-foreground/70 motion-reduce:hidden" />}
                          <span className={cn("relative size-1.5 rounded-full", on ? "bg-ok-foreground" : "bg-muted-foreground")} />
                        </span>
                        {on ? t("active") : t("orderingOff")}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </OpenShopButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
