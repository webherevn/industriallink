-- Hãng/thương hiệu sản phẩm theo từng công ty (STT 28 KD)
ALTER TABLE "candidate"."candidate_experience"
  ADD COLUMN IF NOT EXISTS "brands_technologies" TEXT[] NOT NULL DEFAULT '{}';
