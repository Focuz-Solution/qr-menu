"use client";

import { useShopPath, useShopSlug } from "@/lib/shop-path";
import { Banknote, CheckCircle2, Landmark, Loader2, Minus, Plus, Send, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Opt, Req } from "@/components/FieldMark";
import { TelegramCircleIcon } from "@/components/icons";
import { Img } from "@/components/Img";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clearCart, setQty, useCart } from "@/lib/cart";
import { feeFor, zonesFor, type Zone } from "@/lib/orders";
import { PROVINCES } from "@/lib/provinces";
import type { ErrorCode } from "@/lib/result";
import { formatPrice, type Lang, pick, thumbUrl } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { BackButton } from "../products/[slug]/BackButton";
import { connectTelegram, createOrder } from "./actions";
import { ProvincePicker } from "./ProvincePicker";

// the map (Leaflet) only loads in the browser
const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), { ssr: false });
import type { CheckoutInput, TelegramUser } from "./types";

type Details = Omit<CheckoutInput, "lines" | "key" | "shop">;
const EMPTY: Details = { name: "", phone: "", provinceCode: "", deliveryZoneId: "", address: "", landmark: "", mapUrl: "", note: "", payment: "cod", telegram: null };
const SAVED = "checkout-details"; // ponytail: details were remembered before; now only removed (old phones)
const money = (cents: number) => formatPrice(cents / 100);

type Receipt = {
  orderNo: string;
  details: Details;
  lines: { key: string; name: string; image: string; qty: number; cents: number }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  deliveryZoneName: string;
  totalCents: number;
};

export function Checkout({ zones, minOrderCents, orderingEnabled, telegramBotId }: { zones: Zone[]; minOrderCents: number; orderingEnabled: boolean; telegramBotId: string | null }) {
  const path = useShopPath();
  const t = useTranslations("checkout");
  const { items } = useCart();
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  return (
    <div className="space-y-4 py-3">
      <div className="flex items-center gap-2">
        <BackButton label={t("back")} />
        <h1 className="text-xl font-medium">{receipt ? t("doneTitle") : t("title")}</h1>
      </div>

      {receipt ? (
        <ReceiptView receipt={receipt} />
      ) : items.length === 0 ? (
        <div className="space-y-4 py-16 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href={path()}>{t("browse")}</Link>
          </Button>
        </div>
      ) : !orderingEnabled ? (
        <p className="rounded-2xl bg-secondary p-4 text-sm">{t("closed")}</p>
      ) : (
        <CheckoutForm zones={zones} minOrderCents={minOrderCents} telegramBotId={telegramBotId} onDone={setReceipt} />
      )}
    </div>
  );
}

function CheckoutForm({ zones, minOrderCents, telegramBotId, onDone }: { zones: Zone[]; minOrderCents: number; telegramBotId: string | null; onDone: (r: Receipt) => void }) {
  const path = useShopPath();
  const shopSlug = useShopSlug(); // the order goes to this shop (also when opened at the main address)
  const t = useTranslations("checkout");
  const te = useTranslations("errors");
  const tc = useTranslations("cart");
  const tp = useTranslations("product");
  // variant name ("Option 2" when the admin left it empty, same as the product page) + size: "Rose · 100 ml"
  const vname = ({ variant: v, size }: { variant: { label: string; n: number } | null; size?: { name: string } }) =>
    [v && (v.label || tp("optionN", { n: v.n })), size?.name].filter(Boolean).join(" · ");
  const lang = useLocale() as Lang;
  const { items, total } = useCart();
  // every order starts with an empty form; only a connected Telegram is remembered on the phone (per shop, 30 days).
  // Safe to read here: the form only renders in the browser (on the server the cart is empty).
  const [d, setD] = useState<Details>(() => ({ ...EMPTY, telegram: savedTelegram(shopSlug) }));
  const setTelegram = (telegram: TelegramUser | null) => {
    setD((x) => ({ ...x, telegram }));
    try {
      if (telegram) localStorage.setItem(TG_KEY(shopSlug), JSON.stringify(telegram));
      else localStorage.removeItem(TG_KEY(shopSlug));
    } catch {}
  };
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const key = useRef(crypto.randomUUID()); // same key for retries of this order → never two orders
  // a changed field drops its old error
  const clear = (k: string) =>
    setFields((all) => {
      const rest = { ...all };
      delete rest[k];
      return rest;
    });
  const set = (k: keyof Details) => (e: { target: { value: string } }) => {
    setD((x) => ({ ...x, [k]: e.target.value }));
    clear(k);
  };

  const subtotalCents = Math.round(total * 100);
  const options = zonesFor(zones, d.provinceCode);
  const zone = options.length === 1 ? options[0] : options.find((option) => option.id === d.deliveryZoneId);
  const deliveryFeeCents = zone ? feeFor(zone, subtotalCents) : 0;
  const noDelivery = !!d.provinceCode && !options.length; // province chosen, but no active delivery zone covers it
  const belowMin = minOrderCents > 0 && subtotalCents < minOrderCents;
  const err = (k: string) => fields[k] && <p className="text-xs text-destructive">{te(fields[k])}</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!zone) return;
    setError(undefined);
    setFields({});
    start(async () => {
      const r = await createOrder({ ...d, shop: shopSlug, deliveryZoneId: zone.id, lines: items.map((i) => ({ slug: i.product.slug, image: i.image, size: i.size?.id, qty: i.qty })), key: key.current });
      if (!r.ok) {
        setFields(r.fields ?? {});
        if (!r.fields) setError(r.error);
        return;
      }
      try {
        localStorage.removeItem(SAVED);
      } catch {}
      onDone({
        orderNo: r.data!.orderNo,
        details: d,
        deliveryZoneName: r.data!.deliveryZoneName,
        lines: items.map((i) => ({ key: i.key, name: [pick(i.product.name, lang), vname(i)].filter(Boolean).join(" · "), image: i.image, qty: i.qty, cents: Math.round(i.price * 100) * i.qty })),
        subtotalCents,
        deliveryFeeCents: r.data!.deliveryFeeCents,
        totalCents: r.data!.totalCents,
      });
      clearCart();
    });
  }

  // min-order note, error and the send button: under the summary on desktop, after the form on phones
  const send = (
    <>
      {belowMin && <p className="text-xs text-destructive">{t("minOrder", { amount: money(minOrderCents) })}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
      <Button type="submit" className="h-12 rounded-full text-base" disabled={pending || belowMin || !zone}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("send")}
      </Button>
    </>
  );

  return (
    // phones: one column — summary, payment, receiver, delivery address, send button (CSS order below);
    // desktop: the form on the left, the summary sticking on the right
    <form onSubmit={submit} noValidate className="grid gap-5 md:grid-cols-[1fr_320px] md:items-start md:gap-6">
      {/* "contents" on phones: its sections join the page's column, so payment can move up under the summary */}
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-5">
        {/* who receives it */}
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
          <h2 className="font-semibold">{t("receiver")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("name")} <Req /></Label>
              <Input id="name" value={d.name} onChange={set("name")} aria-required autoComplete="name" maxLength={80} placeholder={t("namePlaceholder")} aria-invalid={!!fields.name || undefined} className="h-11 text-base md:text-sm" />
              {err("name")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t("phone")} <Req /></Label>
              <Input id="phone" value={d.phone} onChange={set("phone")} aria-required type="tel" inputMode="tel" autoComplete="tel" placeholder="012 345 678" aria-invalid={!!fields.phone || undefined} className="h-11 text-base md:text-sm" />
              {err("phone")}
            </div>
          </div>
          {/* optional: status messages on Telegram + the shop can chat with them (no button when the bot isn't set up) */}
          {telegramBotId && <TelegramConnect botId={telegramBotId} shop={shopSlug} user={d.telegram} onChange={setTelegram} />}
        </section>

        {/* where to deliver */}
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border p-4">
          <h2 className="font-semibold">{t("deliverTo")}</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="province">{t("province")} <Req /></Label>
            <ProvincePicker
              id="province"
              value={d.provinceCode}
              onChange={(provinceCode) => {
                setD((x) => ({ ...x, provinceCode, deliveryZoneId: "" }));
                clear("province");
                clear("deliveryZoneId");
              }}
              invalid={!!fields.province || noDelivery}
            />
            {noDelivery && !fields.province && <p className="text-xs text-destructive">{t("noDelivery")}</p>}
            {err("province")}
            {!!options.length && (
              <fieldset className="mt-2 grid gap-2">
                <legend className="mb-2 text-sm font-medium">{t("deliveryService")} <Req /></legend>
                {options.map((option) => {
                  const fee = feeFor(option, subtotalCents);
                  return (
                    <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="deliveryZoneId"
                        value={option.id}
                        checked={zone?.id === option.id}
                        onChange={() => {
                          setD((current) => ({ ...current, deliveryZoneId: option.id }));
                          clear("deliveryZoneId");
                        }}
                      />
                      <span className="min-w-0 flex-1 wrap-break-word">
                        {option.name}
                        {option.eta && <span className="block text-xs text-muted-foreground">{t("eta", { eta: option.eta })}</span>}
                        {/* not free yet: tell them how much more makes it free */}
                        {fee > 0 && option.freeOverCents != null && (
                          <span className="block text-xs text-primary">{t("freeMore", { amount: money(option.freeOverCents - subtotalCents) })}</span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">{fee ? money(fee) : t("free")}</span>
                    </label>
                  );
                })}
                {err("deliveryZoneId")}
              </fieldset>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">{t("address")} <Req /></Label>
            <Textarea id="address" value={d.address} onChange={set("address")} aria-required rows={2} maxLength={300} autoComplete="street-address" placeholder={t("addressPlaceholder")} aria-invalid={!!fields.address || undefined} className="text-base md:text-sm" />
            {err("address")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="landmark">{t("landmark")} <Opt /></Label>
            <Input id="landmark" value={d.landmark} onChange={set("landmark")} maxLength={200} placeholder={t("landmarkPlaceholder")} className="h-11 text-base md:text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label asChild>
              <p>{t("mapUrl")} <Opt /></p>
            </Label>
            <MapPicker value={d.mapUrl} onChange={(mapUrl) => set("mapUrl")({ target: { value: mapUrl } })} />
            {err("mapUrl")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{t("note")} <Opt /></Label>
            <Textarea id="note" value={d.note} onChange={set("note")} rows={2} maxLength={500} placeholder={t("notePlaceholder")} className="text-base md:text-sm" />
          </div>
        </section>

        {/* payment: right after the summary on phones */}
        <fieldset className="-order-1 flex min-w-0 flex-col gap-3 rounded-2xl border p-4 md:order-none">
          <legend className="sr-only">{t("payment")}</legend>
          <p className="font-semibold" aria-hidden>{t("payment")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["cod", t("payCod"), t("payCodHint"), Banknote],
                ["bank_transfer", t("payBank"), t("payBankHint"), Landmark],
              ] as const
            ).map(([value, label, hint, Icon]) => (
              <label
                key={value}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  d.payment === value && "border-primary bg-secondary",
                )}
              >
                <input type="radio" name="payment" value={value} checked={d.payment === value} onChange={() => setD((x) => ({ ...x, payment: value }))} className="sr-only" />
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* phones: the send button comes after the form (the summary is at the top) */}
      <div className="flex flex-col gap-3 md:hidden">{send}</div>

      {/* order summary: first on phones (see what you're ordering before filling the form); sticks beside the form on desktop */}
      <aside className="order-first flex flex-col gap-4 rounded-2xl border p-4 md:sticky md:top-4 md:order-none">
        <h2 className="font-semibold">{t("summary")}</h2>
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.key} className="flex gap-3">
              <Link href={path(`/products/${i.product.slug}`)} className="shrink-0">
                <Img src={thumbUrl(i.image)} alt={pick(i.product.name, lang)} sizes="56px" className="size-14 rounded-lg" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm">{pick(i.product.name, lang)}</span>
                    {/* the picked variant: its own line, small, bold, in the shop colour */}
                    {vname(i) && <span className="text-xs font-semibold text-primary">{vname(i)}</span>}
                  </span>
                  <span className="text-sm font-medium tabular-nums">{formatPrice(i.price * i.qty)}</span>
                </div>
                {/* quantity: − stops at 1; the bin removes the line */}
                <div className="flex items-center justify-between">
                  <div className="flex h-8 items-center rounded-full border">
                    <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label={tc("less")} disabled={i.qty <= 1} onClick={() => setQty(i.key, Math.max(1, i.qty - 1))}>
                      <Minus className="size-3.5" aria-hidden />
                    </Button>
                    <span className="min-w-6 text-center text-sm font-medium tabular-nums">{i.qty}</span>
                    <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label={tc("more")} disabled={i.qty >= 99} onClick={() => setQty(i.key, i.qty + 1)}>
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={tc("remove")} onClick={() => setQty(i.key, 0)}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5 border-t border-dashed pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>{t("subtotal")}</dt>
            <dd className="tabular-nums">{money(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>{t("delivery")}</dt>
            <dd className="tabular-nums">{noDelivery ? t("notAvailable") : !zone ? t(d.provinceCode ? "chooseDeliveryService" : "chooseProvince") : deliveryFeeCents ? money(deliveryFeeCents) : t("free")}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-medium">{t("total")}</dt>
            <dd className="text-xl font-bold text-primary tabular-nums">{money(subtotalCents + deliveryFeeCents)}</dd>
          </div>
        </dl>
        {/* desktop: under the totals */}
        <div className="hidden flex-col gap-3 md:flex">{send}</div>
      </aside>
    </form>
  );
}

/** after sending: order number + what was ordered + where it goes */
function ReceiptView({ receipt: r }: { receipt: Receipt }) {
  const path = useShopPath();
  const t = useTranslations("checkout");
  const lang = useLocale() as Lang;
  const province = PROVINCES.find((p) => p.code === r.details.provinceCode);
  const rows: [string, string | undefined][] = [
    [t("name"), r.details.name],
    [t("phone"), r.details.phone],
    [t("province"), province && pick(province, lang)],
    [t("deliveryService"), r.deliveryZoneName],
    [t("address"), r.details.address],
    [t("landmark"), r.details.landmark],
    [t("mapUrl"), r.details.mapUrl],
    [t("note"), r.details.note],
    [t("payment"), t(r.details.payment === "cod" ? "payCod" : "payBank")],
  ];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-6 text-center">
        <CheckCircle2 className="size-10 text-primary" aria-hidden />
        <p className="font-semibold">{t("doneText")}</p>
        <p className="text-sm text-muted-foreground">
          {t("orderNo")} <span className="font-mono font-semibold text-foreground">{r.orderNo}</span>
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border p-4">
        <h2 className="font-semibold">{t("summary")}</h2>
        <ul className="flex flex-col gap-3">
          {r.lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3">
              <Img src={thumbUrl(l.image)} alt="" sizes="48px" className="size-12 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm">{l.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">× {l.qty}</span>
              </span>
              <span className="text-sm font-medium tabular-nums">{money(l.cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5 border-t border-dashed pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>{t("subtotal")}</dt>
            <dd className="tabular-nums">{money(r.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>{t("delivery")}</dt>
            <dd className="tabular-nums">{r.deliveryFeeCents ? money(r.deliveryFeeCents) : t("free")}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-2">
            <dt className="font-medium">{t("total")}</dt>
            <dd className="text-xl font-bold text-primary tabular-nums">{money(r.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 font-semibold">{t("deliverTo")}</h2>
        <dl className="flex flex-col gap-1.5 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      <Button asChild className="h-12 rounded-full text-base">
        <Link href={path()}>{t("backToShop")}</Link>
      </Button>
    </div>
  );
}

// the connected Telegram, remembered per shop; same 30 days as the server accepts (verifyTelegramLogin in lib/telegram.ts).
// An old-style connection (before OpenID login: no "sig") is dropped → connect again.
const TG_KEY = (shop: string) => `telegram:${shop}`;
const TG_MAX_AGE = 30 * 86_400;

function savedTelegram(shop: string): TelegramUser | null {
  try {
    const user = JSON.parse(localStorage.getItem(TG_KEY(shop)) ?? "null") as TelegramUser | null;
    if (user && typeof user.sig === "string" && typeof user.id === "string" && Date.now() / 1000 - user.auth_date < TG_MAX_AGE) return user;
    localStorage.removeItem(TG_KEY(shop)); // too old (or broken): connect again
  } catch {}
  return null;
}

/**
 * Opens Log In with Telegram (OpenID Connect) in a popup; the person confirms in their Telegram app and the popup
 * posts back a signed id_token (null = closed/refused). Same request as Telegram's telegram-login.js, but with ONE
 * redirect_uri for every shop (that script uses the current page, and BotFather wants each Redirect URI exactly).
 * @BotFather → bot → Login Widget: Redirect URI `<site>/checkout`, Trusted Origin `<site>`.
 */
function telegramLogin(clientId: string, lang: string): Promise<string | null> {
  const OIDC = "https://oauth.telegram.org";
  const url = new URL(`${OIDC}/auth`);
  url.search = new URLSearchParams({
    response_type: "post_message",
    client_id: clientId,
    redirect_uri: `${location.origin}/checkout`,
    // profile = name/username/photo; bot_access = the bot may message them (no Start in the bot needed)
    scope: "openid profile telegram:bot_access",
    lang,
  }).toString();
  const w = 550, h = 650;
  const popup = window.open(url, "telegram_oidc_login", `width=${w},height=${h},left=${Math.max(0, (screen.width - w) / 2)},top=${Math.max(0, (screen.height - h) / 2)}`);
  if (!popup) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve(token);
    };
    function onMessage(e: MessageEvent) {
      if (e.origin !== OIDC || e.source !== popup) return;
      let data: { event?: string; result?: unknown; error?: unknown } | null = null;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {}
      if (data?.event === "auth_result") finish(typeof data.result === "string" && !data.error ? data.result : null);
    }
    window.addEventListener("message", onMessage);
    const watch = setInterval(() => {
      if (popup.closed) {
        clearInterval(watch);
        // the token can arrive just before the popup closes itself
        setTimeout(() => finish(null), 300);
      }
    }, 300);
  });
}

/**
 * "Connect Telegram": Log In with Telegram (telegramLogin above); the server checks the id_token and returns our pass.
 */
function TelegramConnect({ botId, shop, user, onChange }: { botId: string; shop: string; user: TelegramUser | null; onChange: (u: TelegramUser | null) => void }) {
  const t = useTranslations("checkout");
  const lang = useLocale();
  const [busy, setBusy] = useState(false);
  const name = user?.name;

  async function connect() {
    const idToken = await telegramLogin(botId, lang);
    if (!idToken) return; // closed or refused
    setBusy(true);
    try {
      const res = await connectTelegram(shop, idToken);
      if (res.ok && res.data) onChange(res.data);
    } catch {}
    setBusy(false);
  }

  // one row under name/phone, same shape before and after connecting: icon/photo · two lines of text · button
  return (
    <div className="flex items-center gap-3 border-t pt-4">
      {user ? (
        <Avatar className="size-10">
          {user.photo_url && <AvatarImage src={user.photo_url} alt="" className="object-cover" />}
          <AvatarFallback className="text-sm font-semibold">{Array.from(name ?? "")[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : (
        <TelegramCircleIcon className="size-10 shrink-0 text-telegram" />
      )}
      <div className="min-w-0 flex-1">
        {user ? (
          <>
            <p className="truncate text-sm font-medium">{[name, user.username && `@${user.username}`].filter(Boolean).join(" · ")}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0 text-telegram" aria-hidden />
              {t("tgConnected")}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              Telegram <Opt />
            </p>
            <p className="text-xs text-muted-foreground">{t("tgConnectHint")}</p>
          </>
        )}
      </div>
      {user ? (
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label={t("tgDisconnect")} onClick={() => onChange(null)}>
          <X aria-hidden />
        </Button>
      ) : (
        <Button type="button" onClick={connect} disabled={busy} className="relative h-9 shrink-0 rounded-full bg-telegram px-4 text-white after:absolute after:-inset-1 after:content-[''] hover:bg-telegram/90">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {t("tgConnect")}
        </Button>
      )}
    </div>
  );
}
