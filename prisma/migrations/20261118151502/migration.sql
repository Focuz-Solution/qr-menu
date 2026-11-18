-- AlterTable
ALTER TABLE "delivery_zones" ALTER COLUMN "fee_cents" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_pay_driver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "delivery_carriers" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_courier" BOOLEAN NOT NULL DEFAULT false,
    "logo" TEXT,
    "eta" TEXT NOT NULL DEFAULT '',
    "fee_cents" INTEGER NOT NULL,
    "fee_steps" JSONB NOT NULL DEFAULT '[]',
    "pay_driver" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_carriers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_carriers_zone_id_sort_order_idx" ON "delivery_carriers"("zone_id", "sort_order");

-- AddForeignKey
ALTER TABLE "delivery_carriers" ADD CONSTRAINT "delivery_carriers_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
