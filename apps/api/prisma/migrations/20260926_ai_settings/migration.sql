-- AI Gateway runtime settings (chỉnh qua /admin/ai-settings). Bản ghi đơn scope="default".
-- API key được mã hoá AES-256-GCM ở tầng ứng dụng trước khi lưu vào các cột *_enc.
CREATE TABLE IF NOT EXISTS "shared"."ai_setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scope" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT,
    "embedding_dim" INTEGER,
    "openai_api_key_enc" TEXT,
    "openai_model" TEXT,
    "openai_embedding_model" TEXT,
    "anthropic_api_key_enc" TEXT,
    "anthropic_model" TEXT,
    "gemini_api_key_enc" TEXT,
    "gemini_model" TEXT,
    "gemini_embedding_model" TEXT,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_setting_scope_key" ON "shared"."ai_setting" ("scope");
