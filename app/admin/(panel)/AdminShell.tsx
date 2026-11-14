"use client";

import { ArrowLeftRight, Check, EllipsisVertical, Languages, LogOut, Package, Plus, ReceiptText, Send, Settings, ShieldCheck, Truck, Users } from "lucide-react";
import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ShopLogo } from "@/components/ShopLogo";
import { SwitchingOverlay } from "@/components/SwitchingOverlay";
import type { ShopUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout, setAdminLang } from "../actions";
import { openShop } from "../shops/actions";

export function AdminShell({
  user,
  newOrders,
  shopName,
  logo,
  shops,
  children,
}: {
  user: ShopUser;
  newOrders: number;
  shopName: string;
  logo: string;
  /** shops this person can open (user menu → Switch shop) */
  shops: MenuShop[];
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const path = usePathname().replace(/\/$/, "");
  const nav = [
    // `perm`: shown only to people whose role has it (no perm = everyone in the shop); `owner`: the owner only
    { group: "sales" as const, href: "/admin/orders", match: "/admin/orders", label: t("nav.orders"), icon: ReceiptText, count: newOrders },
    { group: "sales" as const, href: "/admin/menu", match: "/admin/menu", label: t("nav.menu"), icon: Package, perm: "menu.edit" as Permission },
    { group: "setup" as const, href: "/admin/delivery", match: "/admin/delivery", label: t("nav.delivery"), icon: Truck, perm: "delivery.manage" as Permission },
    { group: "setup" as const, href: "/admin/telegram", match: "/admin/telegram", label: t("telegram.title"), icon: Send, perm: "telegram.manage" as Permission },
    { group: "setup" as const, href: "/admin/users", match: "/admin/users", label: t("nav.users"), icon: Users, perm: "users.manage" as Permission },
    { group: "setup" as const, href: "/admin/roles", match: "/admin/roles", label: t("nav.roles"), icon: ShieldCheck, owner: true },
    { group: "setup" as const, href: "/admin/settings", match: "/admin/settings", label: t("nav.settings"), icon: Settings },
  ].filter((item) => (item.owner ? user.isOwner : !item.perm || can(user, item.perm)));

  return (
    <div className="min-h-full md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-3 py-2 md:h-dvh md:flex-col md:items-stretch md:gap-1 md:border-r md:border-b-0 md:px-3 md:py-5">
        <div className="flex items-center gap-2.5 md:px-2 md:pb-4">
          <ShopLogo src={logo} alt={shopName} size={36} />
          {/* shop name only (no "Admin" line under it) */}
          <p className="hidden min-w-0 truncate font-heading text-lg leading-tight font-semibold md:block">{shopName}</p>
        </div>

        <nav aria-label={t("nav.label")} className="flex min-w-0 flex-1 gap-1 overflow-x-auto md:flex-none md:flex-col md:gap-0.5 md:overflow-visible">
          {nav.map(({ group, href, match, label, icon: Icon, count }, i) => {
            // a section also covers its sub-pages (orders → one order)
            const active = path === match || path.startsWith(`${match}/`);
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
                  // selected: the shop's brand colour (Settings → Appearance) — light tint behind, coloured text + icon;
                  // no brand colour set → the default black, so it stays a soft grey
                  active && "bg-primary/10 font-medium text-primary hover:bg-primary/15",
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
          <UserMenu user={user} shops={shops} />
        </div>
      </aside>

      <main className="mx-auto w-full min-w-0 flex-1 p-4 md:p-8 2xl:w-6xl 2xl:px-0">
        {children}
      </main>
    </div>
  );
}

/** shadcn-style user button: avatar + name + phone / email + ⋮; opens a menu (language, sign out) */
type MenuShop = { id: string; name: string; logo: string };

function UserMenu({ user, shops }: { user: ShopUser; shops: MenuShop[] }) {
  const t = useTranslations("admin");
  const tl = useTranslations("lang");
  const locale = useLocale();
  // switching shop: cover the page with a spinner until the other shop's dashboard has loaded
  const [switching, startSwitch] = useTransition();
  const [target, setTarget] = useState("");
  // switching language: same cover until the page is back in the other language
  const [changingLang, startLang] = useTransition();
  const avatar = (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold uppercase" aria-hidden>
      {user.name.slice(0, 1)}
    </span>
  );
  const who = (
    <span className="grid min-w-0 flex-1 text-left leading-tight">
      <span className="truncate text-sm font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">{user.contact}</span>
    </span>
  );

  return (
    <>
      {switching && <SwitchingOverlay text={t("shops.switching", { name: target })} />}
      {changingLang && <SwitchingOverlay text={tl("switching")} />}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("nav.account")}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-md p-1.5 outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-foreground/5"
        >
          {avatar}
          {/* name, role under it (the phone / email shows inside the menu) */}
          <span className="hidden min-w-0 flex-1 text-left leading-tight md:grid">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.isOwner ? t("roles.owner") : user.roleName}</span>
          </span>
          <EllipsisVertical className="hidden size-4 shrink-0 text-muted-foreground md:block" aria-hidden />
        </DropdownMenuTrigger>
        {/* flat (no shadow, thin border), small corners, exactly as wide as the sidebar button (phones: the avatar → 14rem) */}
        <DropdownMenuContent side="top" align="start" className="w-56 min-w-0 rounded-lg shadow-none ring-foreground/10 md:w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
            {avatar}
            {who}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Switch shop ›: every shop you can open (✓ = this one); tap one → its dashboard. Hidden with just one shop. */}
          {shops.length > 1 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowLeftRight aria-hidden />
                {t("shops.switch")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 w-56 overflow-y-auto rounded-lg shadow-none ring-foreground/10">
                {shops.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => {
                      if (s.id === user.shop.id) return;
                      setTarget(s.name);
                      startSwitch(() => openShop(s.id));
                    }}
                  >
                    <ShopLogo src={s.logo} alt="" size={20} className="size-5" />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {s.id === user.shop.id && <Check className="text-foreground" aria-label={t("shops.current")} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {/* owner only: make another shop */}
          {user.isOwner && (
            <DropdownMenuItem asChild>
              <Link href="/admin/shops/new">
                <Plus aria-hidden />
                {t("shops.addShop")}
              </Link>
            </DropdownMenuItem>
          )}
          {(shops.length > 1 || user.isOwner) && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => startLang(() => setAdminLang(locale === "en" ? "km" : "en"))}>
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
    </>
  );
}
