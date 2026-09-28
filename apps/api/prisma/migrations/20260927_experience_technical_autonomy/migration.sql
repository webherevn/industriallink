-- Mức tự chủ kỹ thuật theo từng công ty (matching jd11 per company).
ALTER TABLE "candidate"."candidate_experience"
  ADD COLUMN IF NOT EXISTS "technical_autonomy_level" INTEGER;
