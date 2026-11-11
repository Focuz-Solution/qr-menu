// Brand colour helpers (plan/multi-shop.md → Appearance). Pure functions: used in the browser (preview) and on the server (save).
// ponytail: only picks white/black text by contrast; the darken-until-readable palette and logo swatches come in P8.

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** relative luminance (WCAG 2) of "#rrggbb" */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** text colour on a brand-colour button: white when it reads well (contrast ≥ 4.5 : 1), else black */
export function textOn(hex: string): "#ffffff" | "#000000" {
  return (1.05 / (luminance(hex) + 0.05)) >= 4.5 ? "#ffffff" : "#000000";
}

export function brandStyles(brandColor: string | null, brandText: string | null) {
  return brandColor
    ? ({
        "--primary": brandColor,
        "--primary-foreground": brandText ?? "#ffffff",
        "--ring": brandColor,
        "--secondary": `color-mix(in oklch, ${brandColor} 8%, white)`,
        "--accent": `color-mix(in oklch, ${brandColor} 8%, white)`,
      } as React.CSSProperties)
    : undefined;
}
