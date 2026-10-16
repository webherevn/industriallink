-- Kỳ chốt hoa hồng theo tháng. Chưa duyệt chi và chưa vào ví.
CREATE TABLE "crm"."crm_commission_period" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL,
  "period_month" TEXT NOT NULL,
  "paid_amount_vnd" BIGINT NOT NULL,
  "commission_vnd" BIGINT NOT NULL,
  "entry_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'closed',
  "closed_by_user_id" UUID NOT NULL,
  "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_period_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_commission_period_month" CHECK ("period_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT "crm_commission_period_status" CHECK ("status" = 'closed'),
  CONSTRAINT "crm_commission_period_amounts" CHECK ("entry_count" > 0 AND "paid_amount_vnd" > 0 AND "commission_vnd" > 0)
);

CREATE UNIQUE INDEX "crm_commission_period_partner_id_period_month_key" ON "crm"."crm_commission_period"("partner_id", "period_month");
CREATE INDEX "crm_commission_period_period_month_idx" ON "crm"."crm_commission_period"("period_month");

ALTER TABLE "crm"."crm_commission_period"
  ADD CONSTRAINT "crm_commission_period_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm"."crm_commission_entry" ADD COLUMN "period_id" UUID;

CREATE INDEX "crm_commission_entry_period_id_idx" ON "crm"."crm_commission_entry"("period_id");

ALTER TABLE "crm"."crm_commission_entry"
  ADD CONSTRAINT "crm_commission_entry_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "crm"."crm_commission_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
