/*
  Warnings:

  - You are about to drop the column `max_per_order` on the `items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "items" DROP COLUMN "max_per_order";

-- AlterTable
ALTER TABLE "shop_settings" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'km',
ADD COLUMN     "notice" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "order_prefix" SET DEFAULT 'PB-';
