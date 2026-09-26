-- Kiểm duyệt tin tuyển dụng 2 lớp (bộ lọc tĩnh + Gemini) + điểm tín nhiệm công ty.

-- Company: điểm tín nhiệm 0–100 (mặc định 50).
ALTER TABLE "company"."company"
  ADD COLUMN IF NOT EXISTS "trust_score" INTEGER NOT NULL DEFAULT 50;

-- Job: các trường phục vụ kiểm duyệt.
ALTER TABLE "recruitment"."job"
  ADD COLUMN IF NOT EXISTS "moderation_status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "ai_risk_score" INTEGER,
  ADD COLUMN IF NOT EXISTS "ai_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "ai_is_b2b" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "ai_suggested_action" TEXT,
  ADD COLUMN IF NOT EXISTS "moderation_note" TEXT,
  ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderated_by" UUID;

-- Tin đã public trước khi có tính năng này coi như đã được duyệt tự động.
UPDATE "recruitment"."job"
  SET "moderation_status" = 'approved_auto'
  WHERE "status" = 'published' AND "moderation_status" = 'draft';

CREATE INDEX IF NOT EXISTS "job_moderation_status_idx"
  ON "recruitment"."job"("moderation_status");
