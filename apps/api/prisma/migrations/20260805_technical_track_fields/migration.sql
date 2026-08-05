-- Technical track fields on candidate_profile (reuse sales columns for shared criteria).
ALTER TABLE "candidate"."candidate_profile"
  ADD COLUMN IF NOT EXISTS "job_track" TEXT,
  ADD COLUMN IF NOT EXISTS "brands_technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "technical_work_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "technical_autonomy_level" INTEGER,
  ADD COLUMN IF NOT EXISTS "troubleshooting_level" INTEGER,
  ADD COLUMN IF NOT EXISTS "technical_tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "document_literacy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "system_scale_note" TEXT,
  ADD COLUMN IF NOT EXISTS "shift_flexibility" TEXT;
