-- CreateTable
CREATE TABLE "telegram_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bot_token_enc" TEXT,
    "bot_username" TEXT,
    "chat_id" BIGINT,
    "chat_title" TEXT,
    "message_thread_id" INTEGER,
    "webhook_secret" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_test_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_settings_pkey" PRIMARY KEY ("id")
);


-- one settings row only
ALTER TABLE "telegram_settings" ADD CONSTRAINT "telegram_settings_single_row" CHECK ("id" = 1);
