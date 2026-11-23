import Script from "next/script";

// Google Analytics 4 measurement ID from the env (e.g. G-ABC123XYZ). Read at build time: the shop pages are
// static, so a new or changed ID needs a redeploy. Anything that isn't a GA4 ID turns analytics off (and can't
// be used to slip code into the page).
const GA_ID = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_ID ?? "") ? process.env.NEXT_PUBLIC_GA_ID! : null;

/**
 * Google Analytics on the customer pages only (never /admin). Loads after the page is interactive, so it doesn't
 * slow the first paint. Moves between pages inside the shop are counted by GA4 itself ("page changes based on
 * browser history events", on by default in the data stream's Enhanced measurement).
 * `content_group` = the shop's address, so each shop can be looked at on its own (also on the main address).
 */
export function GoogleAnalytics({ shop }: { shop: string | null }) {
  if (!GA_ID) return null;
  // JSON with "<" escaped: a value can never close the <script> tag early
  const js = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  const config = shop ? { content_group: shop } : {};
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${js(GA_ID)},${js(config)});`}
      </Script>
    </>
  );
}
