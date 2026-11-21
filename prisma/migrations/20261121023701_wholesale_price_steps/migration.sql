/*
  Warnings:

  - You are about to drop the `wholesale_products` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "wholesale_products" DROP CONSTRAINT "wholesale_products_shop_id_fkey";

-- DropTable
DROP TABLE "wholesale_products";

-- CreateTable
CREATE TABLE "wholesale_prices" (
    "item_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tiers" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_prices_pkey" PRIMARY KEY ("item_id")
);

-- CreateIndex
CREATE INDEX "wholesale_prices_shop_id_idx" ON "wholesale_prices"("shop_id");

-- AddForeignKey
ALTER TABLE "wholesale_prices" ADD CONSTRAINT "wholesale_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_prices" ADD CONSTRAINT "wholesale_prices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
