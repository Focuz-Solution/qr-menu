"use client";

import { Check, Gift, Minus, Plus, ShoppingBag, Tag, Truck, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CartLink } from "@/components/CartLink";
import { DiscountBadge } from "@/components/DiscountBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { discountPercent, type Lang, pick, type Product } from "@/lib/shop";
import { addToCart, cartKey, setQty, useCart } from "@/lib/cart";
import { parseRich, type RichBlock, type RichDoc, type RichInline } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { BackButton } from "./BackButton";
import { Variants } from "./Variants";

// The product comes from page.tsx (database).
export function ProductView({ product: p }: { product: Product }) {
  const lang = useLocale() as Lang;
  const t = useTranslations("product");

  const off = discountPercent(p);
  const sections = [
    { key: "description", title: t("description"), body: pick(p.description, lang) },
    { key: "howToUse", title: t("howToUse"), body: (p.howToUse && pick(p.howToUse, lang)) },
    { key: "ingredients", title: t("ingredients"), body: p.ingredients },
  ].filter((s) => s.body);

  return (
    <article className="relative pb-6">
      {/* phones: floats over the photo; desktop: normal row above the columns */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 pt-3 md:static md:pb-4">
        <BackButton label={t("back")} />
      </div>

      <Variants
        product={p}
        header={
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                {p.brand && <p className="text-xl font-bold tracking-wide text-primary">{p.brand}</p>}
                <h1 className="text-[22px] leading-snug font-medium">{pick(p.name, lang)}</h1>
                {!p.inStock && <Badge variant="secondary" className="h-6 px-2">{t("outOfStock")}</Badge>}
              </div>
              <DiscountBadge off={off} className="mt-1" />
            </div>
          </div>
        }
        footer={(image) => <AddToCart slug={p.slug} image={image} disabled={!p.inStock} />}
        details={
          // always open: each section a soft grey card (title + text), no collapse arrow
          <div className="space-y-3 pt-2">
            {sections.map((s) => (
              <section key={s.key} className="space-y-2 rounded-2xl bg-muted/60 p-4">
                <h2 className="font-semibold">{s.title}</h2>
                <div className="leading-relaxed whitespace-pre-line text-muted-foreground">
                  {s.key === "howToUse" ? <Steps text={s.body!} /> : s.key === "description" ? <Description text={s.body!} /> : s.body}
                </div>
              </section>
            ))}
          </div>
        }
      />
    </article>
  );
}

// Adds the photo showing in the gallery: switching thumbnails = a different style = its own cart line
function AddToCart({ slug, image, disabled }: { slug: string; image: string; disabled: boolean }) {
  const t = useTranslations("product");
  const key = cartKey(slug, image);
  const qty = useCart().items.find((i) => i.key === key)?.qty ?? 0;
  return (
    <div className="flex gap-2 pt-2">
      <Button size="lg" className="h-12 flex-1 rounded-full" disabled={disabled || qty > 0} onClick={() => addToCart(key)}>
        <ShoppingBag className="size-5" aria-hidden />
        {t("addToBag")}
      </Button>
      {qty > 0 && (
        <div className="flex h-12 shrink-0 items-center rounded-full border">
          <Button variant="ghost" size="icon" className="h-11 w-10 rounded-full" aria-label={t("less")} onClick={() => setQty(key, qty - 1)}>
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="min-w-5 text-center font-medium tabular-nums">{qty}</span>
          <Button variant="ghost" size="icon" className="h-11 w-10 rounded-full" aria-label={t("more")} onClick={() => setQty(key, qty + 1)}>
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      {qty > 0 && <CartLink className="size-12 border" />}
    </div>
  );
}

// "1. Do this\n2. Then this" (or Khmer "១. …") → numbered step rows
function Steps({ text }: { text: string }) {
  const steps = text.split("\n").map((line) => {
    const m = line.match(/^\s*([0-9០-៩]+)[.)]\s*(.*)$/);
    return m ? { n: m[1], body: m[2] } : { n: "", body: line };
  });
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="w-5 shrink-0 font-semibold text-primary">{step.n || i + 1}.</span>
          <span className="text-foreground/80">{step.body}</span>
        </li>
      ))}
    </ol>
  );
}

type LineKind = "feature" | "offer" | "item" | "heading";

// "✅ …" = feature, "💵 …" = offer, "• …" = item, anything else = heading; the emoji/bullet itself is dropped
function parseLine(line: string): { kind: LineKind; text: string } {
  const t = line.trim();
  if (t.startsWith("✅")) return { kind: "feature", text: t.slice(1).trim() };
  if (t.startsWith("💵")) return { kind: "offer", text: t.slice(2).trim() };
  if (t.startsWith("•")) return { kind: "item", text: t.slice(1).trim() };
  return { kind: "heading", text: t };
}

// ponytail: icon picked by keyword (km + en); add words here if a new offer gets the wrong icon
function offerIcon(text: string): LucideIcon | null {
  if (/ដឹក|delivery/i.test(text)) return Truck;
  if (/ថែម|ហ្វ្រី|free/i.test(text)) return Gift;
  return null;
}

// Description written with the editor: drawn node by node with React (text only, never raw HTML)
const ALIGN = { left: "", center: "text-center", right: "text-right" } as const;
const MARK = { bold: "font-semibold text-foreground", italic: "italic", underline: "underline", strike: "line-through" } as const;

function RichInlines({ nodes }: { nodes?: RichInline[] }) {
  return nodes?.map((n, i) =>
    n.type === "hardBreak" ? <br key={i} /> : n.marks ? <span key={i} className={cn(n.marks.map((m) => MARK[m.type]))}>{n.text}</span> : n.text,
  );
}

function RichBlocks({ blocks }: { blocks: RichBlock[] }) {
  return blocks.map((b, i) => {
    if (b.type === "bulletList" || b.type === "orderedList") {
      const L = b.type === "bulletList" ? "ul" : "ol";
      return (
        <L key={i} className={cn("space-y-1 pl-5", b.type === "bulletList" ? "list-disc" : "list-decimal")}>
          {b.content.map((item, j) => (
            <li key={j}><RichBlocks blocks={item.content} /></li>
          ))}
        </L>
      );
    }
    const align = ALIGN[b.attrs?.textAlign ?? "left"];
    if (b.type === "heading") {
      const H = b.attrs.level === 2 ? "h3" : "h4"; // the page's own headings come first
      return <H key={i} className={cn("pt-1 font-semibold text-foreground", b.attrs.level === 2 ? "text-lg" : "text-base", align)}><RichInlines nodes={b.content} /></H>;
    }
    return <p key={i} className={cn("min-h-[1lh]", align)}><RichInlines nodes={b.content} /></p>;
  });
}

function RichDescription({ doc }: { doc: RichDoc }) {
  return (
    <div className="flex flex-col gap-1 whitespace-pre-wrap text-foreground/80">
      <RichBlocks blocks={doc.content} />
    </div>
  );
}

// Product description: editor text as written; old plain text as a checklist + offer box instead of raw emoji lines
function Description({ text }: { text: string }) {
  const doc = parseRich(text);
  if (doc) return <RichDescription doc={doc} />;
  // consecutive lines of the same kind form one group (one list / one box)
  const groups: { kind: LineKind; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const { kind: parsed, text: line } = parseLine(raw);
    // a "•" line about delivery or a free gift belongs with the offers (cream box), not the plain checklist
    const kind = parsed === "item" && offerIcon(line) ? "offer" : parsed;
    const last = groups.at(-1);
    if (last && last.kind === kind && kind !== "heading") last.lines.push(line);
    else groups.push({ kind, lines: [line] });
  }

  return (
    // gap-2.5 = the spacing inside the lists, so a heading sits as close to its list as the rows do
    <div className="flex flex-col gap-2.5 whitespace-normal">
      {groups.map((g, i) => {
        if (g.kind === "heading") {
          return (
            // reads as one more check row: same badge, weight and text colour as the list under it
            <p key={i} className="flex items-start gap-3 text-foreground/80">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
              {g.lines[0]}
            </p>
          );
        }
        if (g.kind === "feature") {
          return (
            <ul key={i} className="space-y-2.5">
              {g.lines.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="text-foreground/80">{line}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (g.kind === "offer") {
          return (
            <ul key={i} className="space-y-2.5 rounded-2xl bg-secondary p-4">
              {g.lines.map((line) => {
                const Icon = offerIcon(line) ?? Tag;
                return (
                  <li key={line} className="flex items-center gap-3">
                    <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                    <span className="font-medium text-foreground">{line}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return (
          <ul key={i} className="space-y-2.5">
            {g.lines.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-foreground/80">{line}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
