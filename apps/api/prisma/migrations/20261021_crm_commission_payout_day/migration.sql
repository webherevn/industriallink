-- Ngày trong tháng kế toán ghi đã chi. Không tự trừ ví và không chuyển khoản.
CREATE TABLE "crm"."crm_commission_payout_setting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "payout_day" INTEGER NOT NULL DEFAULT 10,
  "updated_by_user_id" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_payout_setting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_commission_payout_day_range" CHECK ("payout_day" >= 1 AND "payout_day" <= 28)
);

INSERT INTO "crm"."crm_commission_payout_setting" ("id", "payout_day") VALUES ('default', 10);
