-- Một dòng nhật ký cho một đơn gói đã thanh toán. Không đổi bước phễu.
ALTER TABLE "crm"."crm_activity" ADD COLUMN "billing_order_id" UUID;

CREATE UNIQUE INDEX "crm_activity_billing_order_id_key" ON "crm"."crm_activity"("billing_order_id");

ALTER TABLE "crm"."crm_activity"
  ADD CONSTRAINT "crm_activity_billing_order_id_fkey"
  FOREIGN KEY ("billing_order_id") REFERENCES "billing"."billing_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
