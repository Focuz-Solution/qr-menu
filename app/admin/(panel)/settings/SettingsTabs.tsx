"use client";

import { Store, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// tabs as links: every tab has its own address (/admin/settings/, /admin/settings/staff/)
export function SettingsTabs() {
  const t = useTranslations("admin.settings");
  const path = usePathname().replace(/\/$/, "");
  const tabs = [
    { href: "/admin/settings/", match: "/admin/settings", label: t("tabShop"), icon: Store },
    { href: "/admin/settings/staff/", match: "/admin/settings/staff", label: t("tabStaff"), icon: Users },
  ];

  return (
    <nav aria-label={t("title")} className="mb-5 flex gap-1 shadow-[inset_0_-1px_0_var(--border)]">
      {tabs.map(({ href, match, label, icon: Icon }) => {
        const active = path === match;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-2 border-b-2 border-transparent px-4 text-sm font-medium text-muted-foreground hover:text-foreground",
              active && "border-foreground text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
