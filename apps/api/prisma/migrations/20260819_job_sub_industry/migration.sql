-- Ngành chi tiết trong nhóm ngành tin tuyển dụng
ALTER TABLE "recruitment"."job"
  ADD COLUMN IF NOT EXISTS "sub_industry" TEXT;
