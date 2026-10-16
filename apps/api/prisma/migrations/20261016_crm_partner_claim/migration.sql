-- Mỗi mã số thuế chỉ thuộc một cộng tác viên. Không tạo ví hoa hồng.
CREATE TABLE IF NOT EXISTS "crm"."crm_partner_claim" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL REFERENCES "crm"."crm_partner"("id"),
  "company_name" TEXT NOT NULL,
  "tax_code" TEXT NOT NULL,
  "contact_phone" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_partner_claim_tax_code_key" ON "crm"."crm_partner_claim" ("tax_code");
CREATE INDEX IF NOT EXISTS "crm_partner_claim_partner_id_idx" ON "crm"."crm_partner_claim" ("partner_id");
