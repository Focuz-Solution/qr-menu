"use client";

import { ArrowLeft, Banknote, Check, CircleCheck, Clock, Copy, Download, Landmark, Loader2, MapPin, MessageCircle, Phone, Undo2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { Req } from "@/components/FieldMark";
import { Img } from "@/components/Img";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus, PaymentStatus } from "@/lib/generated/prisma/enums";
import { NEXT_STATUS } from "@/lib/order-status";
import { mapCoords } from "@/lib/orders";
import type { ErrorCode } from "@/lib/result";
import { thumbUrl } from "@/lib/shop";
import { setOrderStatus, setPaymentStatus } from "../../order-actions";
import type { AdminOrder } from "../../order-types";
import { fullAddress, localPhone, money, PaymentPill, StatusPill } from "../../order-ui";
import { cn } from "@/lib/utils";

/** card with a header row (same look as the other admin cards); `action` sits at the right of the header */
function Box({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`gap-0 overflow-hidden py-0 ${className ?? ""}`}>
      <div className="flex min-h-12 items-center gap-2 border-b px-4 md:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="flex flex-col gap-3 p-4 md:p-5">{children}</div>
    </Card>
  );
}

/**
 * copies the customer's pin for the Google Maps app search box / a driver chat:
 * "11.556400,104.928200" from the checkout map link; an older pasted link is copied as it is
 */
function CopyLocation({ url }: { url: string }) {
  const t = useTranslations("admin.orders");
  const [copied, setCopied] = useState(false);
  const text = mapCoords(url) ?? url;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check className="text-ok-foreground" aria-hidden /> : <Copy aria-hidden />}
      {t(copied ? "copied" : "copyLocation")}
    </Button>
  );
}

/** one order on its own page: customer, items, totals, status buttons, history */
/** `canChangeStatus` = the person's role has "orders.status" (else the next-step buttons are replaced by a note) */
export function OrderView({ order: o, canChangeStatus }: { order: AdminOrder; canChangeStatus: boolean }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const phone = localPhone(o.customerPhone);

  function printReceipt() {
    const lines = [
      o.orderNo,
      format.dateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" }),
      o.customerName,
      "",
      ...o.items.map((item) =>
        [item.name, item.variant, `${item.quantity} × ${money(item.unitPriceCents)} = ${money(item.lineTotalCents)}`].filter(Boolean).join(" · "),
      ),
      "",
      `${t("orders.subtotal")}: ${money(o.subtotalCents)}`,
      `${t("orders.delivery")} (${o.deliveryZoneName}): ${o.deliveryPayDriver ? t("orders.payDriver") : money(o.deliveryFeeCents)}`,
      ...(o.discountCents > 0 ? [`${t("orders.discount")}: −${money(o.discountCents)}`] : []),
      `${t("orders.total")}: ${money(o.totalCents)}`,
      `${t("orders.payment")}: ${t(`orders.paymentMethods.${o.paymentMethod}`)} · ${t(`orders.paymentStatuses.${o.paymentStatus}`)}`,
    ];
    const frame = document.createElement("iframe");
    frame.className = "fixed size-0 border-0";
    frame.setAttribute("aria-hidden", "true");
    document.body.append(frame);
    const preview = frame.contentWindow;
    if (!preview) {
      frame.remove();
      return;
    }

    const receipt = preview.document;
    receipt.title = `${o.orderNo}-receipt`;
    receipt.documentElement.lang = document.documentElement.lang;
    const content = receipt.createElement("pre");
    content.style.cssText = "font: 11pt/1.6 sans-serif; white-space: pre-wrap; overflow-wrap: anywhere";
    content.textContent = lines.join("\n");
    receipt.body.append(content);
    preview.addEventListener("afterprint", () => frame.remove(), { once: true });
    preview.print();
  }

  return (
    <>
      {/* header: back to the list, order number + status, date */}
      <div className="mb-5 flex flex-col gap-3">
        <Link href="/admin/orders" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t("orders.title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-medium md:text-3xl">{o.orderNo}</h1>
              <StatusPill status={o.status} />
            </div>
            <p className="text-sm text-muted-foreground">{format.dateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          {/* page action, top right (same place as other admin pages' main button) */}
          <Button variant="outline" size="sm" className="ml-auto" onClick={printReceipt}>
            <Download aria-hidden />
            {t("orders.downloadReceipt")}
          </Button>
        </div>
      </div>

      {/* order status: full width progress bar; tap the next step to move the order */}
      <StatusBox order={o} canChange={canChangeStatus} />

      {/* desktop: left = customer, items · right = payment, history.
          phones: one column in the order staff use it — customer, payment, items, history ("contents" + order) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          {/* customer + where to deliver */}
          <Box title={t("orders.customer")} className="order-1 min-w-0 lg:order-0">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
              <div className="min-w-0">
                {/* their Telegram photo (when they connected Telegram at checkout and it is public), else the first letter of the name */}
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    {o.telegramLinked && <AvatarImage src={`/admin/orders/${o.id}/telegram-photo`} alt="" className="object-cover" />}
                    <AvatarFallback className="text-base font-semibold">{Array.from((o.customerTelegramName ?? o.customerName).trim())[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold wrap-break-word">{o.customerName}</p>
                    {o.customerTelegramName && (
                      <p className="text-sm wrap-break-word text-muted-foreground">
                        {t("orders.telegramName", { name: [o.customerTelegramName, o.customerTelegram].filter(Boolean).join(" ") })}
                      </p>
                    )}
                  </div>
                </div>
                {/* contact: the way that will work is the main (filled) button — Telegram when they connected it
                    (by @username, always opens), else a phone call (Telegram by phone may not find them) */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant={o.customerTelegram ? "default" : "outline"} className={o.customerTelegram ? "bg-telegram text-white hover:bg-telegram/90" : ""}>
                    <a href={`https://t.me/${o.customerTelegram?.slice(1) ?? o.customerPhone}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden />
                      {t("telegram.chatCustomer")}
                    </a>
                  </Button>
                  <Button asChild size="sm" variant={o.customerTelegram ? "outline" : "default"} className={o.customerTelegram ? "" : "order-first"}>
                    <a href={`tel:${o.customerPhone}`} aria-label={t("orders.call", { phone })}>
                      <Phone aria-hidden />
                      {phone}
                    </a>
                  </Button>
                </div>
              </div>
              {/* where to deliver: address, landmark and the map button together */}
              <div className="min-w-0 space-y-1 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                <p className="text-xs font-semibold text-muted-foreground">{t("orders.address")}</p>
                <p className="text-sm wrap-break-word">{fullAddress(o)}</p>
                {o.landmark && <p className="text-sm wrap-break-word text-muted-foreground">{o.landmark}</p>}
                {o.mapUrl && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={o.mapUrl} target="_blank" rel="noreferrer">
                        <MapPin aria-hidden />
                        {t("orders.map")}
                      </a>
                    </Button>
                    <CopyLocation url={o.mapUrl} />
                  </div>
                )}
              </div>
            </div>
            {/* the customer's note from checkout; always shown so staff know there is none */}
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm wrap-break-word whitespace-pre-line">
              <span className="font-medium">{t("orders.note")}:</span>{" "}
              {o.note ?? <span className="text-muted-foreground">{t("orders.noNote")}</span>}
            </p>
          </Box>

          {/* items + totals */}
          <ItemsBox order={o} className="order-3 lg:order-0" />
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          {/* payment: amount, method, Pending → Paid + its button */}
          <PaymentBox order={o} canChange={canChangeStatus} className="order-2 min-w-0 lg:order-0" />

          {/* history */}
          <Box title={t("orders.history")} className="order-4 min-w-0 lg:order-0">
            <ol className="flex flex-col gap-2 border-l pl-4 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="relative">
                  <CircleCheck className="absolute top-0.5 -left-6 size-4 bg-card text-ok-foreground" aria-hidden />
                  <span className="text-muted-foreground tabular-nums">
                    {format.dateTime(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {" · "}
                  {e.type === "created"
                    ? t("orders.placed")
                    : e.toStatus
                      ? t(`status.${e.toStatus}`)
                      : e.payment
                        ? t("orders.paymentChanged", { status: t(`orders.paymentStatuses.${e.payment}`) })
                        : e.type}
                  {e.actor && <span className="text-muted-foreground"> · {e.actor}</span>}
                </li>
              ))}
            </ol>
          </Box>
        </div>
      </div>
    </>
  );
}

/** the normal path of an order; "cancelled" is shown apart (it can happen from new / confirmed / packing) */
const FLOW = ["new", "confirmed", "packing", "shipped", "delivered"] as const satisfies OrderStatus[];
const shortDate = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } as const;

/**
 * order status as a progress bar: New → Confirmed → Packing → Shipped → Delivered.
 * Done steps are green with ✓ and their time; the next step is a button (the server still only allows one step at a time);
 * "Cancel order" sits in the card header and asks for a reason.
 */
function StatusBox({ order: o, canChange }: { order: AdminOrder; canChange: boolean }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<OrderStatus>();
  const router = useRouter();
  const next = NEXT_STATUS[o.status];
  const cancelled = o.status === "cancelled";
  // when the order reached a step: "new" = when it was placed, else the newest history entry for it
  const reachedAt = (s: OrderStatus) => (s === "new" ? o.createdAt : o.events.findLast((e) => e.toStatus === s)?.createdAt);
  // the furthest step reached (a cancelled order: the last step it got to before being cancelled)
  const reached = cancelled ? Math.max(0, FLOW.findLastIndex((s) => reachedAt(s))) : FLOW.indexOf(o.status as (typeof FLOW)[number]);
  const forward = next.filter((s) => s !== "cancelled");

  function move(to: OrderStatus, reason?: string) {
    setError(undefined);
    setTarget(to);
    start(async () => {
      const r = await setOrderStatus(o.id, to, reason);
      if (!r.ok) {
        setError(r.fields?.reason ?? r.error);
        // someone else already moved this order: reload it so the bar shows where it really is
        if (r.error === "badTransition") router.refresh();
      } else setCancelling(false);
    });
  }

  return (
    <Box
      title={t("orders.updateStatus")}
      className="mb-4 min-w-0"
      action={
        canChange &&
        next.includes("cancelled") &&
        !cancelling && (
          <Button variant="outline" size="sm" className="text-destructive" disabled={pending} onClick={() => setCancelling(true)}>
            <XCircle aria-hidden />
            {t("orders.confirmCancel")}
          </Button>
        )
      }
    >
      <ol className="grid grid-cols-5">
        {FLOW.map((s, i) => {
          const done = i <= reached;
          const current = !cancelled && i === reached;
          const isNext = canChange && forward.includes(s);
          const at = done && reachedAt(s);
          const inner = (
            <>
              <span
                className={cn(
                  "relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done
                    ? cancelled
                      ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                      : "border-ok-foreground bg-ok-foreground text-background"
                    : isNext
                      ? "border-dashed border-foreground/50 bg-card text-foreground group-hover:border-solid group-hover:border-foreground group-hover:bg-foreground group-hover:text-background"
                      : "border-border bg-card text-muted-foreground",
                  current && "ring-4 ring-ok",
                )}
              >
                {pending && target === s ? <Loader2 className="size-4 animate-spin" aria-hidden /> : done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-xs font-medium md:text-sm", !done && !isNext && "text-muted-foreground", current && "font-semibold")}>{t(`status.${s}`)}</span>
              {at && <span className="text-[11px] leading-tight text-muted-foreground tabular-nums md:text-xs">{format.dateTime(at, shortDate)}</span>}
            </>
          );
          return (
            <li key={s} className="relative flex flex-col items-center" aria-current={current ? "step" : undefined}>
              {/* the line from the previous step to this one: green once this step is reached */}
              {i > 0 && (
                <span className={cn("absolute top-[17px] right-1/2 left-[-50%] h-0.5", done && !cancelled ? "bg-ok-foreground" : "bg-border")} aria-hidden />
              )}
              {isNext ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => move(s)}
                  aria-label={t("orders.moveTo", { status: t(`status.${s}`) })}
                  className="group flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
                >
                  {inner}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-1 text-center">{inner}</div>
              )}
            </li>
          );
        })}
      </ol>

      {cancelled ? (
        <div className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 wrap-break-word">
            <span className="font-semibold">{t("status.cancelled")}</span>
            {reachedAt("cancelled") && <span className="tabular-nums"> · {format.dateTime(reachedAt("cancelled")!, shortDate)}</span>}
            {o.cancelReason && <span className="block text-foreground">{t("orders.cancelReason")}: {o.cancelReason}</span>}
          </p>
        </div>
      ) : next.length && !canChange ? (
        <p className="text-center text-sm text-muted-foreground">{t("orders.noStatusPermission")}</p>
      ) : forward.length ? (
        <p className="text-center text-sm text-muted-foreground">{t("orders.statusHint")}</p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t("orders.noNext")}</p>
      )}

      {cancelling && (
        <form
          className="flex flex-col gap-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            move("cancelled", String(new FormData(e.currentTarget).get("reason") ?? ""));
          }}
        >
          <Label htmlFor="reason">{t("orders.cancelReason")} <Req /></Label>
          <Textarea id="reason" name="reason" required maxLength={300} rows={2} placeholder={t("orders.cancelReasonHint")} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelling(false)}>{t("orders.back")}</Button>
            <Button type="submit" variant="outline" size="sm" className="text-destructive" disabled={pending}>{t("orders.confirmCancel")}</Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
    </Box>
  );
}

const payTone: Record<PaymentStatus, string> = {
  unpaid: "bg-warn text-warn-foreground",
  paid: "bg-ok text-ok-foreground",
  refunded: "bg-muted text-muted-foreground",
};
const payAmountLabel = { unpaid: "amountDue", paid: "amountPaid", refunded: "amountRefunded" } as const;

/** payment: the amount big in a coloured panel (amber = waiting, green = paid, grey = refunded), the method, when it changed, one button to move it along */
function PaymentBox({ order: o, canChange, className }: { order: AdminOrder; canChange: boolean; className?: string }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode>();
  const [status, setShown] = useOptimistic(o.paymentStatus);
  const set = (to: PaymentStatus) =>
    start(async () => {
      setError(undefined);
      setShown(to);
      const r = await setPaymentStatus(o.id, to);
      if (!r.ok) setError(r.error);
    });
  // when (and by whom) it last became this status: the newest matching history entry (pending = since the order was placed)
  const last = o.events.findLast((x) => x.payment === status);
  const since = format.dateTime(last?.createdAt ?? o.createdAt, shortDate);
  const Method = o.paymentMethod === "cod" ? Banknote : Landmark;
  const StatusIcon = status === "paid" ? CircleCheck : status === "refunded" ? Undo2 : Clock;

  return (
    <Box title={t("orders.payment")} action={<PaymentPill status={status} />} className={className}>
      <div className={cn("rounded-xl p-4", payTone[status])}>
        <p className="text-xs font-medium">{t(`orders.${payAmountLabel[status]}`)}</p>
        <p className={cn("mt-0.5 text-3xl font-semibold tracking-tight text-foreground tabular-nums", status === "refunded" && "text-muted-foreground")}>
          {money(o.totalCents)}
        </p>
        {o.deliveryPayDriver && <p className="mt-0.5 text-xs">{t("orders.plusDriver")}</p>}
        <div className="mt-3 flex items-center gap-2 border-t border-current/15 pt-3 text-sm text-foreground">
          <span className="flex size-8 items-center justify-center rounded-full bg-card">
            <Method className="size-4 text-muted-foreground" aria-hidden />
          </span>
          <span className="font-medium">{t(`orders.paymentMethods.${o.paymentMethod}`)}</span>
        </div>
      </div>

      {/* what happened last: "Paid · 19 Nov, 10:21 · Dara" */}
      <p className="flex items-center gap-1.5 text-sm">
        <StatusIcon className={cn("size-4 shrink-0", status === "paid" ? "text-ok-foreground" : status === "refunded" ? "text-destructive" : "text-warn-foreground")} aria-hidden />
        <span className="font-medium">{t(`orders.paymentStatuses.${status}`)}</span>
        <span className="min-w-0 truncate text-muted-foreground tabular-nums">
          · {since}
          {last?.actor && ` · ${last.actor}`}
        </span>
      </p>

      {/* the next step: Pending → Mark as paid; Paid → Refund / Undo; Refunded → back to pending */}
      {canChange && (
        <div className="flex gap-2">
          {status === "unpaid" && (
            <Button className="w-full" disabled={pending} onClick={() => set("paid")}>
              <Check aria-hidden />
              {t("orders.markPaid")}
            </Button>
          )}
          {status === "paid" && (
            <>
              <Button variant="outline" size="sm" className="flex-1" disabled={pending} onClick={() => set("unpaid")}>
                {t("orders.undoPaid")}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive" disabled={pending} onClick={() => set("refunded")}>
                <Undo2 aria-hidden />
                {t("orders.refund")}
              </Button>
            </>
          )}
          {status === "refunded" && (
            <Button variant="outline" size="sm" className="w-full" disabled={pending} onClick={() => set("unpaid")}>
              {t("orders.undoPaid")}
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
    </Box>
  );
}

/** what was ordered + totals */
function ItemsBox({ order: o, className }: { order: AdminOrder; className?: string }) {
  const t = useTranslations("admin");
  return (
    <Box title={t("orders.items")} className={`min-w-0 ${className ?? ""}`}>
      {o.items.map((i) => (
        <div key={i.id} className="flex items-center gap-3">
          {i.imageUrl ? (
            <Img src={thumbUrl(i.imageUrl)} alt={i.name} sizes="56px" className="size-14 shrink-0 rounded-lg" />
          ) : (
            <div className="size-14 shrink-0 rounded-lg bg-foreground/5" />
          )}
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="line-clamp-2">{i.name}{i.variant && ` · ${i.variant}`}</span>
            <span className="text-muted-foreground tabular-nums">{money(i.unitPriceCents)} × {i.quantity}</span>
          </p>
          <p className="text-sm font-medium tabular-nums">{money(i.lineTotalCents)}</p>
        </div>
      ))}
      {/* totals: soft grey panel; labels left, amounts right; the total bigger under a dashed line */}
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2.5 rounded-xl bg-muted/50 p-4 text-sm tabular-nums">
        <dt className="text-muted-foreground">
          {t("orders.subtotal")}
          <span className="text-xs"> · {t("orders.itemsCount", { count: o.items.reduce((n, i) => n + i.quantity, 0) })}</span>
        </dt>
        <dd className="text-right">{money(o.subtotalCents)}</dd>
        <dt className="text-muted-foreground">
          {t("orders.delivery")}
          {/* the delivery service on its own small line */}
          <span className="block text-xs">{o.deliveryZoneName}</span>
        </dt>
        <dd className={cn("text-right", !o.deliveryPayDriver && !o.deliveryFeeCents && "font-medium text-ok-foreground")}>
          {o.deliveryPayDriver ? t("orders.payDriver") : o.deliveryFeeCents ? money(o.deliveryFeeCents) : t("orders.free")}
        </dd>
        {o.discountCents > 0 && (
          <>
            <dt className="text-muted-foreground">{t("orders.discount")}</dt>
            <dd className="text-right text-ok-foreground">−{money(o.discountCents)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("orders.payment")}</dt>
        <dd className="flex items-center justify-end gap-1.5 font-medium">
          {o.paymentMethod === "cod" ? <Banknote className="size-4 text-muted-foreground" aria-hidden /> : <Landmark className="size-4 text-muted-foreground" aria-hidden />}
          {t(`orders.paymentMethods.${o.paymentMethod}`)}
        </dd>
        {/* one row across both columns, so the dashed line runs unbroken (a <div> around dt + dd is allowed in <dl>) */}
        <div className="col-span-2 mt-1 grid grid-cols-subgrid items-baseline border-t border-dashed pt-3">
          <dt className="text-base font-semibold">{t("orders.total")}</dt>
          <dd className="text-right text-lg font-semibold">{money(o.totalCents)}</dd>
        </div>
      </dl>
    </Box>
  );
}
