-- Cho phép chi một kỳ đã chốt. Không trừ ví.
ALTER TABLE "crm"."crm_commission_period" DROP CONSTRAINT "crm_commission_period_status";

ALTER TABLE "crm"."crm_commission_period"
  ADD CONSTRAINT "crm_commission_period_status" CHECK ("status" IN ('closed', 'payable'));

ALTER TABLE "crm"."crm_commission_period" ADD COLUMN "approved_by_user_id" UUID;
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN "approved_at" TIMESTAMP(3);
