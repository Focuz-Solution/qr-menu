import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Button asChild className="h-11">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </div>
  );
}
