-- Ngoại ngữ chi tiết: nghe / nói / đọc / viết + đọc manual kỹ thuật
ALTER TABLE "candidate"."candidate_profile"
  ADD COLUMN IF NOT EXISTS "language_skills" JSONB NOT NULL DEFAULT '[]'::jsonb;
