-- JD Sales B2B: lưu 22 trường matching (JSON) + track để lọc khi không có jobLevel riêng.
ALTER TABLE "recruitment"."job"
  ADD COLUMN IF NOT EXISTS "job_track" TEXT,
  ADD COLUMN IF NOT EXISTS "sales_criteria" JSONB;

CREATE INDEX IF NOT EXISTS "job_job_track_idx"
  ON "recruitment"."job" ("job_track");
