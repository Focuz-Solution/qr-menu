-- CreateTable
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_sizes" (
    "item_id" UUID NOT NULL,
    "size_id" UUID NOT NULL,
    "price_cents" INTEGER,

    CONSTRAINT "item_sizes_pkey" PRIMARY KEY ("item_id","size_id")
);

-- CreateIndex
CREATE INDEX "sizes_shop_id_sort_order_idx" ON "sizes"("shop_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_shop_id_name_key" ON "sizes"("shop_id", "name");

-- CreateIndex
CREATE INDEX "item_sizes_size_id_idx" ON "item_sizes"("size_id");

-- AddForeignKey
ALTER TABLE "sizes" ADD CONSTRAINT "sizes_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sizes" ADD CONSTRAINT "item_sizes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sizes" ADD CONSTRAINT "item_sizes_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
