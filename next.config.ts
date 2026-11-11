import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  // the cart page became part of checkout: old links / bookmarks still work
  async redirects() {
    return [{ source: "/cart", destination: "/checkout/", permanent: true }];
  },
};

// reads ./i18n/request.ts
export default createNextIntlPlugin()(nextConfig);
