import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // no "/" at the end of addresses (/admin/orders, /products/x); an old link with "/" redirects to it
  trailingSlash: false,
  images: { unoptimized: true },
  // basic security headers on every page: no framing by other sites (clickjacking on /admin), no MIME guessing,
  // only the origin in the Referer sent to other sites, no camera/mic/location access
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // the cart page became part of checkout: old links / bookmarks still work
  async redirects() {
    return [
      { source: "/:shop/cart", destination: "/:shop/checkout", permanent: true },
      // staff moved out of Settings into its own page
      { source: "/admin/settings/staff", destination: "/admin/users", permanent: true },
    ];
  },
};

// reads ./i18n/request.ts
export default createNextIntlPlugin()(nextConfig);
