"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { SwitchingOverlay } from "@/components/SwitchingOverlay";

/** a "Your shops" row's button: while its form opens the shop, the page shows the switching cover */
export function OpenShopButton({ name, ...props }: React.ComponentProps<"button"> & { name: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("admin.shops");
  return (
    <>
      <button type="submit" disabled={pending} {...props} />
      {pending && <SwitchingOverlay text={t("switching", { name })} />}
    </>
  );
}
