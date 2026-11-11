<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: QR Cosmetics Catalogue

Product catalogue opened by QR scan (mobile) or shared link (desktop). Customers browse and order via Telegram/Facebook chat. The shop owner manages products in `/admin` (Next.js server on Vercel + Neon Postgres).

## Read first
- `plan/DESIGN.md` — source of truth for screens, flow, data shape, style. Don't add what §4.0 removes.
- `plan/TASKS.md` — build order. Work one task at a time, in order; tick its checkbox when "Done when" passes.
- `plan/` — backend plan: `README.md` (status + decisions), `architecture.md`, `api.md` (server actions + API routes), `database.md`, `business-rules.md` (rules the code must follow), `phases.md` (P1–P9).

## Stack
- Next.js 16 App Router on **Vercel**, server mode (`trailingSlash: true`, `images.unoptimized`); Cache Components from plan P2.
- Database: **Neon Postgres** via **Prisma 7** (`prisma/schema.prisma`, client generated to `lib/generated/prisma`, import `prisma` from `@/lib/db`; adapter picked in `lib/db.ts`: `@prisma/adapter-neon` for `*.neon.tech`, `@prisma/adapter-pg` for any other PostgreSQL, e.g. local pgAdmin). Connection string in `DATABASE_URL` (`DATABASE_URL_UNPOOLED` for migrations, see `prisma.config.ts`) (`.env` or `.env.local` locally, Vercel env in production). Photos: **Cloudflare R2** (private bucket) via `@aws-sdk/client-s3` + `sharp`, same as castlykh: `POST /admin/images/` (owner/staff, under /admin so the session cookie is sent, re-encodes to WebP ≤ 1920 px) → `images/<uuid>.webp`, served by `GET /api/images/<id>.webp` (cached 1 year); helpers in `lib/r2.ts`, browser `lib/upload-image.ts`. Env: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (no public URL). Secrets in the database (Telegram bot token) are encrypted with `lib/crypto.ts` (`ENCRYPTION_KEY` env, `openssl rand -base64 32`).
- React 19, TypeScript, Tailwind CSS 4, shadcn/ui style **radix-maia** (from preset `bbVJxYW`: pill-shaped controls, radius 0.625rem) in `components/ui/` — keep Radix (`radix-ui`), not Base UI; icons `lucide-react`.
- Fonts (`app/fonts.ts` + `--app-font` in `app/globals.css`): **Khmer → Google Sans**, **English → Inter** (`html:lang(en)`, Khmer words fall back to Google Sans).
- Languages: **Khmer (default) + English**, next-intl. Texts in `public/messages/km.json` + `public/messages/en.json` (same keys). Files: `i18n/request.ts` (locale = `setRequestLocale` from the shop, else the admin cookie) and `LOCALES` in `lib/shop.ts`; **no i18n routing, no `proxy.ts`, no `[locale]` folder**. Chinese (`zh`) is out of scope.
  - **Shop** (`app/(shop)/` route group, root layout there; URLs have no language: `/`, `/products/<slug>/`, `/checkout/`, `/qr/`; `/cart` redirects to `/checkout/`): one language for the whole shop, picked by the owner in Admin → Settings → Appearance (`shop_settings.language`, read with `shopSettings()` from `lib/shop-settings.ts`; every shop page/layout calls `setRequestLocale(language)` with it, not the URL). **No language switch in the shop header.** Pages stay static (saving settings revalidates them). The header running text is `shop_settings.notice` (empty → no running text).
  - **Admin** (`app/admin/`, own root layout): Khmer by default; sidebar button switches to English (cookie `admin_lang`, read in `i18n/request.ts`).
  - Product/category text: `T` fields `{ km, en }`; show with `pick(t, lang)` (falls back to Khmer when English is empty).
- Light theme only: dark mode is out of scope (don't add dark colours or `dark:` styles).
- QR codes: **qrcode.react** — owner-only page `/qr/` (`app/qr/QrStudio.tsx`) draws a designed card on a canvas and downloads it as PNG. Not linked from the customer UI.
- Data: Prisma models `ShopSettings`, `User`, `Session`, `Category`, `Item`, `ItemImage`, `DeliveryZone` (see `plan/database.md`; migrations in `prisma/migrations/`); `npm run db:seed` creates only the first owner account (email + password written in `prisma/seed.ts`; only its scrypt hash is saved) — categories and products are added in Admin → Menu and the shop reads them from the database with `getMenu()` (`lib/menu.ts`; visible categories/items only, mapped to the shop `Product` type) — client parts get them via `components/MenuProvider.tsx` (`useProducts()`). Shop name/logo/language/header text come from `shopSettings()` (`lib/shop-settings.ts`). `lib/shop.ts` keeps only types, helpers (`pick`, `formatPrice`, `discountPercent`) and `shop` defaults/config — no demo data, no banners. Every Menu/Settings save calls `revalidatePath("/", "layout")` so the static shop pages refresh. Photo uploads go to Cloudflare R2 (P4).

## Testing
The agent only runs `npm run lint` and `npm run build`. No browser checks, test scripts, Playwright/automation tools, or local servers — the user tests by hand using the **User tests** list in each task of `plan/TASKS.md`.

## Hard rules
- Server features (server actions, cookies, `proxy.ts`, revalidation) are for **`/admin` and data loading only**. Customer pages stay public and cached; no customer accounts.
- Only admin pages/actions may write to the database — **one exception: the public checkout action `createOrder` (`app/(shop)/checkout/actions.ts`)**, which re-checks every field, takes prices from the database, limits orders per device and uses an idempotency key. **Every admin page and server action starts with `await requireUser(roles?)`** (`lib/auth.ts`) — never rely on the layout or `proxy.ts` alone — and returns `Result` (`lib/result.ts`; error codes are keys of `errors` in messages).
- `useSearchParams` components must be inside `<Suspense>`.
- Allowed packages: shadcn's (via `npx shadcn@latest add`), `next-intl`, `qrcode.react`, `prisma` + `@prisma/client` + `@prisma/adapter-neon` + `@prisma/adapter-pg` (7.10.x; `tsx` for the seed), `@aws-sdk/client-s3` + `sharp` (R2 photo upload/serving). Ask before adding anything else (no auth library). No state or cart libraries.
- next-intl: shop **and** admin code use plain `next/link` / `next/navigation` (no URL languages). Every shop page/layout calls `setRequestLocale` with the shop language from `shopSettings()`. New UI text goes into **both** `km.json` and `en.json`.
- Use shadcn components (add them with the CLI; don't hand-write copies). Theme via CSS vars in `app/globals.css`, not hard-coded colors.
- Mobile-first; desktop with `md:`/`lg:`. Every shop page content in `mx-auto w-full max-w-4xl px-4`; admin body: `mx-auto w-full min-w-0 flex-1 p-4 md:p-8 2xl:w-6xl 2xl:px-0` (full width with padding; 1152px centred from 2xl).
- Cart: `lib/cart.ts` (localStorage); **no separate cart page** — the header bag icon opens `/checkout/`: order summary with − / ＋ / remove per line + the form (receiver, province, address, landmark, map link, note, payment: cash on delivery / bank transfer; order summary; the form starts empty every time (no details remembered); receipt with order number). No online payments. Order rules in `lib/orders.ts`; new orders go to Admin → Orders and the Telegram group.
- Out of scope — don't build: online payments, customer login/profile, wishlist, ratings/reviews, bottom nav bar, notifications, in-app QR scanner, desktop "open on phone" QR, Chinese language, dark mode.
- Every user-facing string comes from `public/messages/*.json` (via `useTranslations` / `getTranslations`) or product `T` fields (via `pick`) — no hard-coded text in components.
- Accessibility: `alt` on images, tap targets ≥ 44px, `aria-label` on icon-only buttons.
- Forms: **every field label shows whether it is required or optional** — required: red `*` (`<Req />`), optional: `(ស្រេចចិត្ត)` / `(optional)` (`<Opt />`), both from `components/FieldMark.tsx`, placed after the label text. Required inputs also get `required` (or `aria-required` when the form uses `noValidate`). On/off switches and checkboxes get no mark. The server still validates every field.

## Admin UI patterns
Reference: `app/admin/(panel)/Orders.tsx`. New admin pages copy these so the UI stays consistent.
- **Page header:** one row — left: `h1` (`font-heading text-2xl font-medium md:text-3xl`) + subtitle under it (`text-sm text-muted-foreground`, text key `<section>.intro`); right (`ml-auto`): search (`w-full max-w-md`, `h-11`, `Search` icon inside, short `searchPlaceholder` + full hint in `aria-label`) or the page's main button. `mb-4`.
- **Stat cards** (optional): `grid grid-cols-2 gap-3 md:grid-cols-4`, each `Card` `px-4 py-3`: value `text-xl font-semibold tabular-nums`, label `text-xs text-muted-foreground`.
- **Filter tabs:** underline style with `ToggleGroup` (not shadcn `Tabs` pills): items `h-12 px-4 text-sm font-medium`, grey text, active = dark text + `border-b-2 border-foreground`; grey count badge `rounded-full bg-muted px-1.5 text-xs`; row has a 1px bottom line (`shadow-[inset_0_-1px_0_var(--border)]`), swipes sideways on phones with the scrollbar hidden. Changing tab/search resets to page 1.
- **Table:** inside `Card className="gap-0 overflow-hidden py-0"`. Header `bg-muted/50`, `h-11`, `text-xs font-medium text-muted-foreground`; first column `pl-4`, last `pr-4`. Rows `h-14`, whole row clickable with a `<button>` in the first cell for keyboard. Main column (id/name) `font-medium`; secondary columns `text-muted-foreground`; numbers/money `text-right tabular-nums`; long text `max-w-40 truncate`; hide minor columns on phones (`hidden md:table-cell` / `lg:table-cell`). Empty state = one full-width row, centred grey text.
- **Sorting:** clickable column headers (`components/SortHead.tsx`, shared): first click descending, second ascending; `ArrowUpDown` (faded) when unsorted, `ArrowUp`/`ArrowDown` when sorted; `aria-sort` on the `th`.
- **Pagination:** `components/Pager.tsx` + `paginate()` (shared; texts in `admin.table`), below the card (not inside), always shown: left `Showing {from}–{to} of {total}`, right `Page {page} of {pages}` + two `outline` icon buttons `size-8 rounded-md` (‹ ›, `aria-label` previous/next page, disabled at the ends). No page-number buttons. 20 rows per page.
- **Status pills:** `rounded-full px-2 py-0.5 text-xs font-semibold` + dot, colours from theme tokens (`bg-info`, `bg-warn`, `bg-ok`…).
- **Shape:** inputs and normal buttons keep the theme's pill shape; small icon buttons in tables/pagination are `rounded-md` squares (not full-round).
- **Button size** (for **new** buttons only — leave existing `h-11` buttons as they are unless asked): secondary/outline buttons in admin (page header actions like View live menu, card header Add, Rename, Cancel, Change token…) always use `<Button variant="outline" size="sm">` (32px) — never `className="h-11"` / `h-11 rounded-full` on them. Only the one main action of a form or empty state (primary `Button`, e.g. Save, Add category) may stay `h-11`.

## Conventions
- Server components by default; `'use client'` only for interactive parts (search/filter, variant picker, share).
- Route-local components live next to their page (`app/Catalogue.tsx`); shared UI in `components/`.
- Use `cn()` from `lib/utils.ts` for class merging.
- Never run git commands that change history or the repo (commit, push, reset, etc.). The user handles git.
- **Database migrations: the user runs them, never the agent.** The agent only edits `prisma/schema.prisma` (and may run `npx prisma generate` / `npx prisma validate`); it does not create or edit migration folders and does not run `prisma migrate …`, `db push`, `db seed` or anything that writes to the database. After a schema change, tell the user to run `npx prisma migrate dev --name <what-changed>`. Only change the model — **never write migration SQL** or give `--create-only` / edit-the-SQL steps (not even for renames); just tell the user the one command.
- After finishing a task, stop and ask the user before starting the next one.
- Unsure or plan/DESIGN.md conflicts with reality? Stop and ask; don't invent features.
