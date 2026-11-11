/*
  Warnings:

  - You are about to drop the column `eta_en` on the `delivery_zones` table. All the data in the column will be lost.
  - You are about to drop the column `eta_km` on the `delivery_zones` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `delivery_zones` table. All the data in the column will be lost.
  - You are about to drop the column `name_km` on the `delivery_zones` table. All the data in the column will be lost.
  - You are about to drop the column `description_en` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `description_km` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `name_km` on the `items` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `name_km` on the `order_items` table. All the data in the column will be lost.
  - You are about to drop the column `address_en` on the `shop_settings` table. All the data in the column will be lost.
  - You are about to drop the column `address_km` on the `shop_settings` table. All the data in the column will be lost.
  - You are about to drop the column `hours_en` on the `shop_settings` table. All the data in the column will be lost.
  - You are about to drop the column `hours_km` on the `shop_settings` table. All the data in the column will be lost.
  - Added the required column `name` to the `delivery_zones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `order_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "delivery_zones" DROP COLUMN "eta_en",
DROP COLUMN "eta_km",
DROP COLUMN "name_en",
DROP COLUMN "name_km",
ADD COLUMN     "eta" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "items" DROP COLUMN "description_en",
DROP COLUMN "description_km",
DROP COLUMN "name_en",
DROP COLUMN "name_km",
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "name_en",
DROP COLUMN "name_km",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "shop_settings" DROP COLUMN "address_en",
DROP COLUMN "address_km",
DROP COLUMN "hours_en",
DROP COLUMN "hours_km",
ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "hours" TEXT NOT NULL DEFAULT '';
