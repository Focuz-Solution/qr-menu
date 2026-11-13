import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireLogin } from "@/lib/auth";
import { publicHost } from "@/lib/shops";
import { NewShopForm } from "./NewShopForm";

// "Create a shop" (owner only): ← Your shops, title, then the form card — centred
export default async function NewShopPage() {
  const user = await requireLogin();
  if (!user.isOwner) redirect("/admin/shops");
  const t = await getTranslations("admin.shops");
  // the domain shown in front of the link address: the public site (APP_BASE_URL); locally / not set → example.com
  const host = publicHost();

  return (
    // centred on the page
    <div className="mx-auto max-w-xl">
      <Link href="/admin/shops" className="-ml-1 mb-6 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("createTitle")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("createIntro")}</p>
      <NewShopForm host={host} />
    </div>
  );
}
