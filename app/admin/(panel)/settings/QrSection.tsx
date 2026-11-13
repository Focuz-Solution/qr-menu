"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import { createContext, use, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { isHex, textOn } from "@/lib/brand-colors";
import { cn } from "@/lib/utils";

const W = 1080;
const H = 1350;
const QR = 640;

// Theme colours are oklch(); older canvases ignore that, so fall back to a hex value
function canvasColor(ctx: CanvasRenderingContext2D, value: string, fallback: string) {
  ctx.fillStyle = fallback;
  if (value) ctx.fillStyle = value;
  return ctx.fillStyle;
}

/**
 * card designs: classic (cream + brush script), soft (brand tint, corner circles), ribbon (brand band on top),
 * dots (brand polka dots), arch (brand arch behind the QR), minimal (white). soft / ribbon / dots / arch use the shop's brand colour.
 */
export const QR_STYLES = ["classic", "soft", "ribbon", "dots", "arch", "minimal"] as const;
// designs built on the brand colour (their QR dots use it too, when dark enough to scan)
const BRANDED: readonly QrStyle[] = ["soft", "ribbon", "dots", "arch"];

/** the brand colour being picked in Appearance ("#rrggbb"), so the brand designs follow it live; null → the saved one */
export const QrBrandContext = createContext<string | null>(null);
// designs with a brand-coloured outline around the QR's white tile (the others get a filled frame)
const OUTLINED: readonly QrStyle[] = ["soft", "ribbon", "arch"];
export type QrStyle = (typeof QR_STYLES)[number];

// Draws the chosen card design around the QR → PNG (1080×1350, print size)
async function drawCard(qr: HTMLCanvasElement, style: QrStyle, title: string, subtitle: string, url: string, scriptFont: string, brandHex: string | null) {
  await document.fonts.load(`120px ${scriptFont}`); // the script font isn't used on the page, so load it explicitly
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => canvasColor(ctx, css.getPropertyValue(name).trim(), fallback);
  const peach = v("--logo-peach", "#f4ad9e");
  const cream = v("--logo-cream", "#fde7c9");
  const muted = v("--muted-foreground", "#737373");
  // the colour being picked (live), else the saved one the admin layout sets as --primary; text that reads on it
  const brand = brandHex ?? v("--primary", "#111111");
  const hex = brandHex ?? css.getPropertyValue("--primary").trim();
  const onBrand = isHex(hex) ? textOn(hex) : "#ffffff";
  const script = `400 128px ${scriptFont}, ${getComputedStyle(document.body).fontFamily}`;
  const font = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";

  // per design: background, text colours, title font, QR panel colour
  const look = {
    classic: { bg: cream, ink: "#1c1917", sub: muted, title: `400 128px ${scriptFont}, ${font}`, panel: peach },
    soft: { bg: "#ffffff", ink: brand, sub: muted, title: script, panel: brand },
    ribbon: { bg: "#ffffff", ink: onBrand, sub: onBrand, title: script, panel: brand },
    dots: { bg: "#ffffff", ink: brand, sub: muted, title: `700 96px ${font}`, panel: brand },
    arch: { bg: "#ffffff", ink: brand, sub: muted, title: script, panel: brand },
    minimal: { bg: "#ffffff", ink: "#111111", sub: muted, title: `700 96px ${font}`, panel: "#f4f4f5" },
  }[style];

  ctx.fillStyle = look.bg;
  ctx.fillRect(0, 0, W, H);
  if (style === "minimal") {
    // thin frame around the whole card
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, W - 80, H - 80);
  }
  if (style === "soft") {
    // light tint of the brand colour + two big soft circles in the corners
    ctx.fillStyle = brand;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    ctx.arc(60, 40, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - 40, H - 60, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (style === "ribbon") {
    // brand band across the top (name + subtitle sit on it) and a thin one at the bottom
    ctx.fillStyle = brand;
    ctx.fillRect(0, 0, W, 330);
    ctx.fillRect(0, H - 60, W, 60);
  }
  if (style === "dots") {
    // light brand tint + a polka-dot pattern
    ctx.fillStyle = brand;
    ctx.globalAlpha = 0.06;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.14;
    for (let y = 30; y < H; y += 60) {
      for (let x = (y / 60) % 2 ? 60 : 30; x < W; x += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  if (style === "arch") {
    // a big soft arch rising behind the QR
    const r = 440;
    ctx.fillStyle = brand;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(W / 2 - r, H);
    ctx.lineTo(W / 2 - r, 380 + r);
    ctx.arc(W / 2, 380 + r, r, Math.PI, 0);
    ctx.lineTo(W / 2 + r, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (style === "classic") {
    // peach brush stroke behind the name, slightly tilted like a logo
    ctx.save();
    ctx.translate(W / 2, 185);
    ctx.rotate(-0.03);
    ctx.fillStyle = peach;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(-330, -38, 660, 76, 38);
    ctx.fill();
    ctx.restore();
  }

  // shop name + subtitle
  ctx.fillStyle = look.ink;
  ctx.font = look.title;
  ctx.fillText(title, W / 2, 215, W - 160);
  ctx.fillStyle = look.sub;
  if (style === "ribbon") ctx.globalAlpha = 0.85;
  ctx.font = `400 40px ${font}`;
  ctx.fillText(subtitle, W / 2, 305, W - 160);
  ctx.globalAlpha = 1;

  // rounded panel with a white tile for the QR
  const frame = QR + 120;
  const fx = (W - frame) / 2;
  const fy = 350;
  if (OUTLINED.includes(style)) {
    ctx.strokeStyle = look.panel;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(fx + 19, fy + 19, frame - 38, frame - 38, 40);
    ctx.stroke();
  } else {
    ctx.fillStyle = look.panel;
    ctx.beginPath();
    ctx.roundRect(fx, fy, frame, frame, 56);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(fx + 24, fy + 24, frame - 48, frame - 48, 36);
  ctx.fill();
  // brand designs: the QR pattern in the brand colour — only when it's dark enough to scan on white (else black)
  const ink = BRANDED.includes(style) && isHex(hex) && textOn(hex) === "#ffffff" ? hex : null;
  if (ink) {
    const tinted = document.createElement("canvas");
    tinted.width = QR;
    tinted.height = QR;
    const tc = tinted.getContext("2d")!;
    tc.drawImage(qr, 0, 0, QR, QR);
    tc.globalCompositeOperation = "source-in"; // keep the dots' shape, paint them in the brand colour
    tc.fillStyle = ink;
    tc.fillRect(0, 0, QR, QR);
    ctx.drawImage(tinted, fx + 60, fy + 60, QR, QR);
  } else {
    ctx.drawImage(qr, fx + 60, fy + 60, QR, QR);
  }

  // web address under the panel (ribbon: the band is only at the top, so plain grey here)
  ctx.fillStyle = style === "ribbon" ? muted : look.sub;
  ctx.font = `400 32px ${font}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, fy + frame + 90, W - 160);
  ctx.globalAlpha = 1;

  // bottom accent bar (classic only)
  if (style === "classic") {
    ctx.fillStyle = peach;
    ctx.fillRect(0, H - 28, W, 28);
  }

  return c.toDataURL("image/png");
}

/** Settings → Appearance → QR code (next to Page template): a card that opens the shop's home page (`shopUrl` = base/<shop>) */
export function QrSection({ scriptFont, shopName, shopUrl }: { scriptFont: string; shopName: string; shopUrl: string }) {
  const t = useTranslations("qr");
  // starts on Soft (built on the shop's brand colour); the other designs are one tap away
  const [style, setStyle] = useState<QrStyle>("soft");
  const [copied, setCopied] = useState(false);
  const brandHex = use(QrBrandContext);
  // every design drawn once (each is its own picker thumbnail); the chosen one is downloaded
  const [pngs, setPngs] = useState<Partial<Record<QrStyle, string>>>({});
  const qrRef = useRef<HTMLCanvasElement>(null);

  const url = shopUrl;
  const subtitle = t("scanCatalogue");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!qrRef.current) return;
      const next: Partial<Record<QrStyle, string>> = {};
      for (const k of QR_STYLES) next[k] = await drawCard(qrRef.current, k, shopName, subtitle, url, scriptFont, brandHex);
      if (!cancelled) setPngs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopName, url, subtitle, scriptFont, brandHex]);

  const png = pngs[style];

  return (
    // small block inside Appearance, next to Page template: the 4 card designs as thumbnails, link, download
    <div className="flex min-w-0 flex-col gap-2">
      <span id="qr-design" className="text-sm font-medium">{t("printTitle")}</span>
      {/* the 4 designs, then the link + download to their right (below when there's no room) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* tap a card to choose its design (ring = chosen) */}
        <div role="radiogroup" aria-labelledby="qr-design" className="flex gap-1.5">
          {QR_STYLES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={style === k}
              aria-label={t(`styles.${k}`)}
              title={t(`styles.${k}`)}
              onClick={() => setStyle(k)}
              className={cn(
                "w-10 shrink-0 overflow-hidden rounded border outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                style === k && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {pngs[k] ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL preview of the generated PNG
                <img src={pngs[k]} alt="" className="block w-full" />
              ) : (
                <span className="block aspect-[4/5] w-full bg-muted" />
              )}
            </button>
          ))}
        </div>
        {/* link box (copy) + download icon on one row */}
        <div className="flex min-w-0 items-center gap-2">
          {/* the link in a read-only box + copy button (✓ for a moment after copying) */}
          <InputGroup className="h-8 w-56 max-w-full">
            <InputGroupInput readOnly value={url} aria-label={t("link")} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={copied ? t("copied") : t("copy")}
                title={copied ? t("copied") : t("copy")}
                onClick={() =>
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  })
                }
              >
                {copied ? <Check className="text-ok-foreground" aria-hidden /> : <Copy aria-hidden />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Button asChild size="icon" variant="outline" className="size-8 shrink-0" disabled={!png}>
            <a href={png || undefined} download={`qr-shop-${style}.png`} aria-label={t("download")} title={t("download")}>
              <Download aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      {/* source QR, drawn into the cards above; high error correction so print damage still scans */}
      {/* transparent background: every design puts it on a white tile; Soft repaints the dots in the brand colour */}
      <QRCodeCanvas ref={qrRef} value={url} size={QR} level="H" marginSize={0} bgColor="transparent" className="hidden" />
    </div>
  );
}
