ALTER TABLE "shared"."analytics_hit"
  ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER NOT NULL DEFAULT 0;
