-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'staff', 'packer');

-- CreateEnum
CREATE TYPE "Badge" AS ENUM ('new', 'best_seller', 'sale');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('new', 'confirmed', 'packing', 'shipped', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cod', 'bank_transfer');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'paid', 'refunded');

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "brand_color" TEXT,
    "brand_text" TEXT,
    "soft_color" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "khr_rate" INTEGER,
    "order_prefix" TEXT NOT NULL DEFAULT 'PB',
    "ordering_enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_order_cents" INTEGER NOT NULL DEFAULT 0,
    "contact_phone" TEXT,
    "telegram_url" TEXT,
    "facebook_url" TEXT,
    "tiktok_url" TEXT,
    "address_km" TEXT NOT NULL DEFAULT '',
    "address_en" TEXT NOT NULL DEFAULT '',
    "hours_km" TEXT NOT NULL DEFAULT '',
    "hours_en" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'staff',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "telegram_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "brand" TEXT,
    "description_km" TEXT NOT NULL DEFAULT '',
    "description_en" TEXT NOT NULL DEFAULT '',
    "price_cents" INTEGER NOT NULL,
    "compare_at_cents" INTEGER,
    "badge" "Badge",
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "max_per_order" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_images" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "province_codes" TEXT[],
    "fee_cents" INTEGER NOT NULL,
    "free_over_cents" INTEGER,
    "eta_km" TEXT NOT NULL DEFAULT '',
    "eta_en" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'new',
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_phone_raw" TEXT NOT NULL,
    "customer_telegram" TEXT,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "district_name" TEXT,
    "commune_name" TEXT,
    "address_line" TEXT NOT NULL,
    "landmark" TEXT,
    "map_url" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "note" TEXT,
    "delivery_zone_name" TEXT NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "delivery_fee_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cod',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "source" TEXT NOT NULL DEFAULT 'web',
    "idempotency_key" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "telegram_message_id" BIGINT,
    "confirmed_at" TIMESTAMP(3),
    "packed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "item_id" UUID,
    "name_km" TEXT NOT NULL,
    "name_en" TEXT NOT NULL DEFAULT '',
    "variant" TEXT,
    "image_url" TEXT,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus",
    "actor_user_id" UUID,
    "actor_telegram" JSONB,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_counters" (
    "day" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_counters_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "items_slug_key" ON "items"("slug");

-- CreateIndex
CREATE INDEX "items_category_id_sort_order_idx" ON "items"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "item_images_item_id_sort_order_idx" ON "item_images"("item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_customer_phone_created_at_idx" ON "orders"("customer_phone", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules Prisma can't express in schema.prisma (plan/business-rules.md)
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_colors" CHECK (
  ("brand_color" IS NULL OR "brand_color" ~ '^#[0-9a-f]{6}$') AND
  ("brand_text" IS NULL OR "brand_text" ~ '^#[0-9a-f]{6}$') AND
  ("soft_color" IS NULL OR "soft_color" ~ '^#[0-9a-f]{6}$'));
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "items" ADD CONSTRAINT "items_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "items" ADD CONSTRAINT "items_price_not_negative" CHECK ("price_cents" >= 0);
ALTER TABLE "items" ADD CONSTRAINT "items_compare_at_above_price" CHECK ("compare_at_cents" > "price_cents");
ALTER TABLE "items" ADD CONSTRAINT "items_max_per_order_positive" CHECK ("max_per_order" > 0);
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_fees_not_negative" CHECK ("fee_cents" >= 0 AND ("free_over_cents" IS NULL OR "free_over_cents" >= 0));
ALTER TABLE "orders" ADD CONSTRAINT "orders_money_not_negative" CHECK ("subtotal_cents" >= 0 AND "delivery_fee_cents" >= 0 AND "discount_cents" >= 0 AND "total_cents" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_money_not_negative" CHECK ("unit_price_cents" >= 0 AND "line_total_cents" >= 0);
