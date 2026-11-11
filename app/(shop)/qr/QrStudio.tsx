"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/components/MenuProvider";
import { shop, type Lang, pick } from "@/lib/shop";

const W = 1080;
const H = 1350;
const QR = 640;

// Theme colours are oklch(); older canvases ignore that, so fall back to a hex value
function canvasColor(ctx: CanvasRenderingContext2D, value: string, fallback: string) {
  ctx.fillStyle = fallback;
  if (value) ctx.fillStyle = value;
  return ctx.fillStyle;
}

// Draws the card in the logo's style (cream paper, script name on a peach brush stroke, QR in a peach frame) → PNG
async function drawCard(qr: HTMLCanvasElement, title: string, subtitle: string, url: string, scriptFont: string) {
  await document.fonts.load(`120px ${scriptFont}`); // the script font isn't used on the page, so load it explicitly
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const css = getComputedStyle(document.documentElement);
  const peach = canvasColor(ctx, css.getPropertyValue("--logo-peach").trim(), "#f4ad9e");
  const cream = canvasColor(ctx, css.getPropertyValue("--logo-cream").trim(), "#fde7c9");
  const muted = canvasColor(ctx, css.getPropertyValue("--muted-foreground").trim(), "#737373");
  const font = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";

  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, W, H);

  // peach brush stroke behind the name, slightly tilted like the logo
  ctx.save();
  ctx.translate(W / 2, 185);
  ctx.rotate(-0.03);
  ctx.fillStyle = peach;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.roundRect(-330, -38, 660, 76, 38);
  ctx.fill();
  ctx.restore();

  // shop name in the script font + subtitle
  ctx.fillStyle = "#1c1917";
  ctx.font = `400 128px ${scriptFont}, ${font}`;
  ctx.fillText(title, W / 2, 215, W - 160);
  ctx.fillStyle = muted;
  ctx.font = `400 40px ${font}`;
  ctx.fillText(subtitle, W / 2, 305, W - 160);

  // peach rounded frame with a white tile for the QR
  const frame = QR + 120;
  const fx = (W - frame) / 2;
  const fy = 350;
  ctx.fillStyle = peach;
  ctx.beginPath();
  ctx.roundRect(fx, fy, frame, frame, 56);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(fx + 24, fy + 24, frame - 48, frame - 48, 36);
  ctx.fill();
  ctx.drawImage(qr, fx + 60, fy + 60, QR, QR);

  // web address under the frame
  ctx.fillStyle = muted;
  ctx.font = `400 32px ${font}`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, fy + frame + 90, W - 160);

  // bottom accent bar
  ctx.fillStyle = peach;
  ctx.fillRect(0, H - 28, W, 28);

  return c.toDataURL("image/png");
}

export function QrStudio({ scriptFont, shopName }: { scriptFont: string; shopName: string }) {
  const lang = useLocale() as Lang;
  const products = useProducts();
  const t = useTranslations("qr");
  const [target, setTarget] = useState(""); // "" = home, else product slug
  const [png, setPng] = useState("");
  const qrRef = useRef<HTMLCanvasElement>(null);

  const product = products.find((p) => p.slug === target);
  const url = `${shop.url}/${product ? `products/${product.slug}/` : ""}`;
  const subtitle = product ? pick(product.name, lang) : t("scanCatalogue");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!qrRef.current) return;
      const data = await drawCard(qrRef.current, shopName, subtitle, url, scriptFont);
      if (!cancelled) setPng(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopName, url, subtitle, scriptFont]);

  return (
    <section className="space-y-6 py-6">
      <h1 className="font-heading text-2xl font-semibold">{t("printTitle")}</h1>
      <div className="grid gap-6 md:grid-cols-[1fr_280px] md:items-start">
        <div className="overflow-hidden rounded-2xl border bg-muted p-4">
          {png ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL preview of the generated PNG
            <img src={png} alt={`${shopName} QR`} className="mx-auto w-full max-w-sm rounded-lg bg-background" />
          ) : (
            <div className="mx-auto aspect-[4/5] w-full max-w-sm rounded-lg bg-background" />
          )}
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("linkTo")}</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              <option value="">{t("home")}</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {pick(p.name, lang)}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs break-all text-muted-foreground">{url}</p>

          <Button asChild className="h-11 w-full rounded-lg" disabled={!png}>
            <a href={png || undefined} download={`qr-${target || "home"}.png`}>
              <Download className="size-4" aria-hidden />
              {t("download")}
            </a>
          </Button>

          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>

        {/* source QR, drawn into the card above; high error correction so print damage still scans */}
        <QRCodeCanvas ref={qrRef} value={url} size={QR} level="H" marginSize={0} className="hidden" />
      </div>
    </section>
  );
}
