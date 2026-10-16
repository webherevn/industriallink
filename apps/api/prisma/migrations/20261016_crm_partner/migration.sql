-- Hồ sơ cộng tác viên và mã giới thiệu. Chưa có hoa hồng, chưa khóa lead theo mã số thuế.
CREATE TABLE IF NOT EXISTS "crm"."crm_partner" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_partner_phone_key" ON "crm"."crm_partner" ("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_partner_code_key" ON "crm"."crm_partner" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_partner_user_id_key" ON "crm"."crm_partner" ("user_id");

ALTER TABLE "crm"."crm_lead"
  ADD COLUMN IF NOT EXISTS "partner_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_lead_partner_id_fkey'
  ) THEN
    ALTER TABLE "crm"."crm_lead"
      ADD CONSTRAINT "crm_lead_partner_id_fkey"
      FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "crm_lead_partner_id_idx" ON "crm"."crm_lead" ("partner_id");
