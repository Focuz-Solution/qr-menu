"use client";

import { ArrowLeft, CircleCheck, Download, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Req } from "@/components/FieldMark";
import { Img } from "@/components/Img";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { NEXT_STATUS } from "@/lib/order-status";
import type { ErrorCode } from "@/lib/result";
import { thumbUrl } from "@/lib/shop";
import { setOrderStatus } from "../../order-actions";
import type { AdminOrder } from "../../order-types";
import { fullAddress, localPhone, money, StatusPill } from "../../order-ui";

/** card with a header row (same look as the other admin cards) */
function Box({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`gap-0 overflow-hidden py-0 ${className ?? ""}`}>
      <h2 className="flex min-h-12 items-center border-b px-4 text-sm font-semibold md:px-5">{title}</h2>
      <div className="flex flex-col gap-3 p-4 md:p-5">{children}</div>
    </Card>
  );
}

/** one order on its own page: customer, items, totals, status buttons, history */
export function OrderView({ order: o }: { order: AdminOrder }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const phone = localPhone(o.customerPhone);
  const next = NEXT_STATUS[o.status];

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
      `${t("orders.delivery")}: ${money(o.deliveryFeeCents)}`,
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

  function move(to: OrderStatus, reason?: string) {
    setError(undefined);
    start(async () => {
      const r = await setOrderStatus(o.id, to, reason);
      if (!r.ok) setError(r.fields?.reason ?? r.error);
      else setCancelling(false);
    });
  }

  return (
    <>
      {/* header: back to the list, order number + status, date */}
      <div className="mb-5 flex flex-col gap-3">
        <Link href="/admin/" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t("orders.title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{o.orderNo}</h1>
          <StatusPill status={o.status} />
        </div>
        <p className="text-sm text-muted-foreground">{format.dateTime(o.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {/* customer + where to deliver */}
          <Box title={t("orders.customer")} className="[&>h2]:border-b-0 [&>div]:pt-1">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
              <div className="min-w-0">
                <p className="font-semibold wrap-break-word">{o.customerName}</p>
                <a href={`tel:${o.customerPhone}`} className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
                  <Phone className="size-4 shrink-0" aria-hidden />
                  {phone}
                </a>
                {o.customerTelegram && <p className="text-sm break-all text-muted-foreground">{o.customerTelegram}</p>}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">{t("orders.address")}</p>
                <p className="text-sm wrap-break-word">{fullAddress(o)}</p>
                {o.landmark && <p className="text-sm wrap-break-word text-muted-foreground">{o.landmark}</p>}
              </div>
            </div>
            {o.note && (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                {t("orders.note")}: {o.note}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={printReceipt}>
                <Download aria-hidden />
                {t("orders.downloadReceipt")}
              </Button>
              {o.mapUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={o.mapUrl} target="_blank" rel="noreferrer">
                    <MapPin aria-hidden />
                    {t("orders.map")}
                  </a>
                </Button>
              )}
            </div>
            <section className="flex flex-col gap-2 pt-2">
              <h3 className="text-sm font-semibold">{t("orders.updateStatus")}</h3>
              {o.status === "cancelled" && o.cancelReason && <p className="text-sm">{t("orders.cancelReason")}: {o.cancelReason}</p>}
              {next.length ? (
                <div className="flex flex-wrap gap-2">
                  {next
                    .filter((s) => s !== "cancelled")
                    .map((s) => (
                      <Button key={s} size="sm" disabled={pending} onClick={() => move(s)}>
                        {t(`status.${s}`)}
                      </Button>
                    ))}
                  {next.includes("cancelled") && !cancelling && (
                    <Button variant="outline" size="sm" className="text-destructive" disabled={pending} onClick={() => setCancelling(true)}>
                      {t("status.cancelled")}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("orders.noNext")}</p>
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
            </section>
          </Box>

          {/* items + totals */}
          <Box title={t("orders.items")}>
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
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t border-dashed pt-3 text-sm tabular-nums">
              <dt className="text-muted-foreground">{t("orders.subtotal")}</dt>
              <dd className="text-right">{money(o.subtotalCents)}</dd>
              <dt className="text-muted-foreground">{t("orders.delivery")} ({o.deliveryZoneName})</dt>
              <dd className="text-right">{o.deliveryFeeCents ? money(o.deliveryFeeCents) : t("orders.free")}</dd>
              {o.discountCents > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("orders.discount")}</dt>
                  <dd className="text-right">−{money(o.discountCents)}</dd>
                </>
              )}
              <dt className="border-t pt-2 font-semibold">{t("orders.total")}</dt>
              <dd className="border-t pt-2 text-right font-semibold">{money(o.totalCents)}</dd>
              <dt className="text-muted-foreground">{t("orders.payment")}</dt>
              <dd className="text-right">{t(`orders.paymentMethods.${o.paymentMethod}`)} · {t(`orders.paymentStatuses.${o.paymentStatus}`)}</dd>
            </dl>
          </Box>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* history */}
          <Box title={t("orders.history")}>
            <ol className="flex flex-col gap-2 border-l pl-4 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="relative">
                  <CircleCheck className="absolute top-0.5 -left-6 size-4 bg-card text-ok-foreground" aria-hidden />
                  <span className="text-muted-foreground tabular-nums">
                    {format.dateTime(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {" · "}
                  {e.type === "created" ? t("orders.placed") : e.toStatus ? t(`status.${e.toStatus}`) : e.type}
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
