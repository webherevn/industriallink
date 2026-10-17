-- Báo giá Enterprise và các đợt phải thu. Chưa chốt thì chưa thành công nợ.
ALTER TABLE "crm"."crm_quote"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'catalog',
ADD COLUMN "accepted_at" TIMESTAMP(3);

CREATE TABLE "crm"."crm_quote_installment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "amount_vnd" BIGINT NOT NULL,
    "due_on" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "collected_at" TIMESTAMP(3),
    CONSTRAINT "crm_quote_installment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_quote_installment_quote_id_sort_order_idx" ON "crm"."crm_quote_installment"("quote_id", "sort_order");
CREATE INDEX "crm_quote_installment_status_due_on_idx" ON "crm"."crm_quote_installment"("status", "due_on");

ALTER TABLE "crm"."crm_quote_installment"
ADD CONSTRAINT "crm_quote_installment_quote_id_fkey"
FOREIGN KEY ("quote_id") REFERENCES "crm"."crm_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
