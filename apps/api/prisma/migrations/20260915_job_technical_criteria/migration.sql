-- JD Kỹ thuật: lưu 23 trường matching (JSON).
ALTER TABLE "recruitment"."job"
  ADD COLUMN IF NOT EXISTS "technical_criteria" JSONB;
