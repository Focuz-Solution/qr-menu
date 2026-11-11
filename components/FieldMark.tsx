import { useTranslations } from "next-intl";

export function Req() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}


export function Opt() {
  const t = useTranslations("form");
  return <span className="font-normal text-muted-foreground">({t("optional")})</span>;
}
