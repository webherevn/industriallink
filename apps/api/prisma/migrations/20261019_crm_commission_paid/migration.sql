-- Kế toán ghi đã chi: trừ đúng số kỳ khỏi ví inlink. Không chuyển khoản.
ALTER TABLE "crm"."crm_commission_period" DROP CONSTRAINT "crm_commission_period_status";

ALTER TABLE "crm"."crm_commission_period"
  ADD CONSTRAINT "crm_commission_period_status" CHECK ("status" IN ('closed', 'payable', 'paid'));

ALTER TABLE "crm"."crm_commission_period" ADD COLUMN "paid_by_user_id" UUID;
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN "paid_at" TIMESTAMP(3);

ALTER TABLE "crm"."crm_commission_wallet_txn" DROP CONSTRAINT "crm_commission_wallet_txn_kind";

ALTER TABLE "crm"."crm_commission_wallet_txn"
  ADD CONSTRAINT "crm_commission_wallet_txn_kind" CHECK ("kind" IN ('credit', 'debit'));

ALTER TABLE "crm"."crm_commission_wallet_txn" ALTER COLUMN "commission_entry_id" DROP NOT NULL;

ALTER TABLE "crm"."crm_commission_wallet_txn" ADD COLUMN "period_id" UUID;

ALTER TABLE "crm"."crm_commission_wallet_txn"
  ADD CONSTRAINT "crm_commission_wallet_txn_shape" CHECK (
    ("kind" = 'credit' AND "commission_entry_id" IS NOT NULL AND "period_id" IS NULL)
    OR
    ("kind" = 'debit' AND "commission_entry_id" IS NULL AND "period_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX "crm_commission_wallet_txn_period_id_key" ON "crm"."crm_commission_wallet_txn"("period_id");

ALTER TABLE "crm"."crm_commission_wallet_txn"
  ADD CONSTRAINT "crm_commission_wallet_txn_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "crm"."crm_commission_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
