/*
  Warnings:

  - You are about to drop the column `bot_token_enc` on the `telegram_settings` table. All the data in the column will be lost.
  - You are about to drop the column `bot_username` on the `telegram_settings` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_secret` on the `telegram_settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[connect_code]` on the table `telegram_settings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "telegram_settings" DROP COLUMN "bot_token_enc",
DROP COLUMN "bot_username",
DROP COLUMN "webhook_secret",
ADD COLUMN     "connect_code" TEXT,
ADD COLUMN     "connect_expires" TIMESTAMP(3),
ADD COLUMN     "connect_user_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "telegram_settings_connect_code_key" ON "telegram_settings"("connect_code");
