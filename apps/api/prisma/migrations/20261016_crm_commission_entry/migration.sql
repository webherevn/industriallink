-- Một dòng hoa hồng cho một đơn gói đã thanh toán. Không có lệnh chi, không rút.
CREATE TABLE "crm"."crm_commission_entry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "company_name" TEXT NOT NULL,
  "billing_order_id" UUID NOT NULL,
  "order_kind" TEXT NOT NULL,
  "plan_code" TEXT,
  "plan_name" TEXT,
  "paid_amount_vnd" BIGINT NOT NULL,
  "percent" INTEGER NOT NULL,
  "commission_vnd" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_reconcile',
  "paid_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_commission_entry_order_kind" CHECK ("order_kind" IN ('platform', 'sourcing')),
  CONSTRAINT "crm_commission_entry_percent" CHECK ("percent" >= 1 AND "percent" <= 30),
  CONSTRAINT "crm_commission_entry_amounts" CHECK ("paid_amount_vnd" > 0 AND "commission_vnd" >= 0),
  CONSTRAINT "crm_commission_entry_status" CHECK ("status" = 'pending_reconcile')
);

CREATE UNIQUE INDEX "crm_commission_entry_billing_order_id_key" ON "crm"."crm_commission_entry"("billing_order_id");
CREATE INDEX "crm_commission_entry_partner_id_paid_at_idx" ON "crm"."crm_commission_entry"("partner_id", "paid_at");
CREATE INDEX "crm_commission_entry_company_id_idx" ON "crm"."crm_commission_entry"("company_id");

ALTER TABLE "crm"."crm_commission_entry"
  ADD CONSTRAINT "crm_commission_entry_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm"."crm_commission_entry"
  ADD CONSTRAINT "crm_commission_entry_billing_order_id_fkey"
  FOREIGN KEY ("billing_order_id") REFERENCES "billing"."billing_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
