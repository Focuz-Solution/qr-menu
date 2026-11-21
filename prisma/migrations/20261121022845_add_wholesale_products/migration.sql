-- CreateTable
CREATE TABLE "wholesale_products" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "min_qty" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wholesale_products_shop_id_name_idx" ON "wholesale_products"("shop_id", "name");

-- AddForeignKey
ALTER TABLE "wholesale_products" ADD CONSTRAINT "wholesale_products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
