-- Nguồn khách trên lead. Lead cũ để unknown, không gắn hoa hồng.
ALTER TABLE "crm"."crm_lead"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'unknown';
