-- Số hóa đơn đã xuất, gắn một đơn gói đã thanh toán. Không tính VAT, không công nợ.
CREATE TABLE "crm"."crm_order_invoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "billing_order_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "company_name" TEXT NOT NULL,
  "order_kind" TEXT NOT NULL,
  "plan_code" TEXT,
  "plan_name" TEXT,
  "paid_amount_vnd" BIGINT NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "issued_by_user_id" UUID NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_order_invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_order_invoice_order_kind" CHECK ("order_kind" IN ('platform', 'sourcing')),
  CONSTRAINT "crm_order_invoice_amount" CHECK ("paid_amount_vnd" > 0),
  CONSTRAINT "crm_order_invoice_number" CHECK (char_length(btrim("invoice_number")) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX "crm_order_invoice_billing_order_id_key" ON "crm"."crm_order_invoice"("billing_order_id");
CREATE UNIQUE INDEX "crm_order_invoice_invoice_number_key" ON "crm"."crm_order_invoice"("invoice_number");
CREATE INDEX "crm_order_invoice_company_id_idx" ON "crm"."crm_order_invoice"("company_id");

ALTER TABLE "crm"."crm_order_invoice"
  ADD CONSTRAINT "crm_order_invoice_billing_order_id_fkey"
  FOREIGN KEY ("billing_order_id") REFERENCES "billing"."billing_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
