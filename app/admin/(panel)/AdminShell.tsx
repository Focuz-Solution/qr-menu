"use client";

import { EllipsisVertical, Languages, LogOut, Package, ReceiptText, Send, Settings, Truck } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { shop } from "@/lib/shop";
import type { AdminUser } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout, setAdminLang } from "../actions";

// Sidebar on desktop, top bar on mobile. Shows only the sections the role may use (plan/phases.md P2).
export function AdminShell({ user, newOrders, children }: { user: AdminUser; newOrders: number; children: React.ReactNode }) {
  const t = useTranslations("admin");
  const path = usePathname().replace(/\/$/, "");
  const nav = [
    { group: "sales" as const, href: "/admin/", match: "/admin", label: t("nav.orders"), icon: ReceiptText, count: newOrders, roles: ["owner", "staff", "packer"] },
    { group: "sales" as const, href: "/admin/menu/", match: "/admin/menu", label: t("nav.menu"), icon: Package, roles: ["owner", "staff"] },
    { group: "setup" as const, href: "/admin/delivery/", match: "/admin/delivery", label: t("nav.delivery"), icon: Truck, roles: ["owner"] },
    { group: "setup" as const, href: "/admin/telegram/", match: "/admin/telegram", label: t("telegram.title"), icon: Send, roles: ["owner"] },
    { group: "setup" as const, href: "/admin/settings/", match: "/admin/settings", label: t("nav.settings"), icon: Settings, roles: ["owner", "staff", "packer"] },
  ].filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-full md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-3 py-2 md:h-dvh md:flex-col md:items-stretch md:gap-1 md:border-r md:border-b-0 md:px-3 md:py-5">
        <div className="flex items-center gap-2.5 md:px-2 md:pb-4">
          <Image src={shop.logo} alt={shop.name} width={36} height={36} className="rounded-full" />
          <div className="hidden leading-tight md:block">
            <p className="font-heading text-lg font-semibold">{shop.name}</p>
            <p className="text-xs text-muted-foreground">{t("title")}</p>
          </div>
        </div>

        <nav aria-label={t("nav.label")} className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-none md:flex-col md:gap-0.5 md:overflow-visible">
          {nav.map(({ group, href, match, label, icon: Icon, count }, i) => {
            // Orders (/admin) must match exactly; other sections also cover their sub-pages (settings → settings/staff)
            const active = path === match || path.startsWith(match === "/admin" ? "/admin/orders/" : `${match}/`);
            // group heading above the first item of each group (desktop only)
            const heading = group !== nav[i - 1]?.group && (
              <p className={cn("hidden px-2.5 pb-1 text-xs font-medium text-muted-foreground md:block", i > 0 && "md:pt-4")}>
                {t(`nav.groups.${group}`)}
              </p>
            );
            return (
              <Fragment key={href}>
              {heading}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm text-foreground transition-colors hover:bg-foreground/5 md:min-h-9",
                  // selected: light grey background (all items keep dark text/icons)
                  active && "bg-foreground/5 font-medium",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {/* phones: icons only (the top bar has no room for 5 labels) */}
                <span className="hidden md:inline">{label}</span>
                {!!count && (
                  <span className="ml-auto rounded-full bg-info px-1.5 text-[11px] font-bold text-info-foreground">{count}</span>
                )}
              </Link>
              </Fragment>
            );
          })}
        </nav>

        {/* footer: user button → menu (view shop, language, sign out) */}
        <div className="md:mt-auto md:border-t md:pt-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <main className="mx-auto w-full min-w-0 flex-1 p-4 md:p-8 2xl:w-6xl 2xl:px-0">
        {children}
      </main>
    </div>
  );
}

/** shadcn-style user button: avatar + name + email + ⋮; opens a menu (language, sign out) */
function UserMenu({ user }: { user: AdminUser }) {
  const t = useTranslations("admin");
  const tl = useTranslations("lang");
  const locale = useLocale();
  const avatar = (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold uppercase" aria-hidden>
      {user.name.slice(0, 1)}
    </span>
  );
  const who = (
    <span className="grid min-w-0 flex-1 text-left leading-tight">
      <span className="truncate text-sm font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("nav.account")}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-md p-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-foreground/5"
      >
        {avatar}
        {/* name, role under it (the email shows inside the menu) */}
        <span className="hidden min-w-0 flex-1 text-left leading-tight md:grid">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{t(`roles.${user.role}`)}</span>
        </span>
        <EllipsisVertical className="hidden size-4 shrink-0 text-muted-foreground md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          {avatar}
          {who}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setAdminLang(locale === "en" ? "km" : "en")}>
          <Languages aria-hidden />
          <span lang={locale === "en" ? "km" : "en"}>{tl("switchTo")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
          <LogOut aria-hidden />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
