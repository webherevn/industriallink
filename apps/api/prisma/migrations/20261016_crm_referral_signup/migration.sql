-- Nhà tuyển dụng đăng ký trong hạn cookie. Chưa phải hoa hồng và không bật gói.
CREATE TABLE "crm"."crm_referral_signup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL,
  "registered_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_referral_signup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_referral_signup_display_name" CHECK (char_length(btrim("display_name")) BETWEEN 1 AND 160)
);

CREATE UNIQUE INDEX "crm_referral_signup_user_id_key" ON "crm"."crm_referral_signup"("user_id");
CREATE INDEX "crm_referral_signup_partner_id_registered_at_idx" ON "crm"."crm_referral_signup"("partner_id", "registered_at");

ALTER TABLE "crm"."crm_referral_signup"
  ADD CONSTRAINT "crm_referral_signup_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
