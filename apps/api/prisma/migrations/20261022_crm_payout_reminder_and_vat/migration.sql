-- Nhớ đã nhắc ngày chi. Không tự trừ ví.
ALTER TABLE "crm"."crm_commission_payout_setting" ADD COLUMN "reminded_on" TEXT;

-- Thuế suất để trống đến khi SuperAdmin nhập. Không điền 8 hay 10.
CREATE TABLE "crm"."crm_vat_setting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "percent" INTEGER,
  "updated_by_user_id" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_vat_setting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_vat_percent_range" CHECK ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 100))
);

INSERT INTO "crm"."crm_vat_setting" ("id", "percent") VALUES ('default', NULL);
