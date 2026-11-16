/*
  Warnings:

  - A unique constraint covering the columns `[updates_code]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_chat_id" BIGINT,
ADD COLUMN     "customer_telegram_name" TEXT,
ADD COLUMN     "updates_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_updates_code_key" ON "orders"("updates_code");
