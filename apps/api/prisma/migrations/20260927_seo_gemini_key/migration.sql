ALTER TABLE "shared"."ai_setting"
  ADD COLUMN IF NOT EXISTS "seo_gemini_api_key_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "seo_gemini_model" TEXT;
