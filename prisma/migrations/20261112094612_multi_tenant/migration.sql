/*
  Warnings:

  - The primary key for the `order_counters` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `shop_settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `shop_settings` table. All the data in the column will be lost.
  - The primary key for the `telegram_settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `telegram_settings` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shop_id,slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shop_id,slug]` on the table `items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shop_id,order_no]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shop_id` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `delivery_zones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `order_counters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `shop_settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shop_id` to the `telegram_settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'admin';

-- DropIndex
DROP INDEX "categories_slug_key";

-- DropIndex
DROP INDEX "items_slug_key";

-- DropIndex
DROP INDEX "orders_created_at_idx";

-- DropIndex
DROP INDEX "orders_customer_phone_created_at_idx";

-- DropIndex
DROP INDEX "orders_order_no_key";

-- DropIndex
DROP INDEX "orders_status_created_at_idx";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "shop_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "delivery_zones" ADD COLUMN     "shop_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "shop_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "order_counters" DROP CONSTRAINT "order_counters_pkey",
ADD COLUMN     "shop_id" UUID NOT NULL,
ADD CONSTRAINT "order_counters_pkey" PRIMARY KEY ("shop_id", "day");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shop_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "shop_id" UUID;

-- AlterTable
ALTER TABLE "shop_settings" DROP CONSTRAINT "shop_settings_pkey",
DROP COLUMN "id",
ADD COLUMN     "shop_id" UUID NOT NULL,
ADD CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("shop_id");

-- AlterTable
ALTER TABLE "telegram_settings" DROP CONSTRAINT "telegram_settings_pkey",
DROP COLUMN "id",
ADD COLUMN     "shop_id" UUID NOT NULL,
ADD CONSTRAINT "telegram_settings_pkey" PRIMARY KEY ("shop_id");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "is_owner" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "user_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("user_id","shop_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- CreateIndex
CREATE INDEX "memberships_shop_id_idx" ON "memberships"("shop_id");

-- CreateIndex
CREATE INDEX "categories_shop_id_sort_order_idx" ON "categories"("shop_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_shop_id_slug_key" ON "categories"("shop_id", "slug");

-- CreateIndex
CREATE INDEX "delivery_zones_shop_id_sort_order_idx" ON "delivery_zones"("shop_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "items_shop_id_slug_key" ON "items"("shop_id", "slug");

-- CreateIndex
CREATE INDEX "orders_shop_id_status_created_at_idx" ON "orders"("shop_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_shop_id_created_at_idx" ON "orders"("shop_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_shop_id_customer_phone_created_at_idx" ON "orders"("shop_id", "customer_phone", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_shop_id_order_no_key" ON "orders"("shop_id", "order_no");

-- AddForeignKey
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_settings" ADD CONSTRAINT "telegram_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
