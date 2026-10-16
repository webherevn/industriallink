-- Một tỷ lệ hoa hồng. Không tạo số dư, không tạo lệnh chi.
CREATE TABLE IF NOT EXISTS "crm"."crm_commission_setting" (
  "id" TEXT PRIMARY KEY DEFAULT 'default',
  "percent" INTEGER NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_commission_percent_range" CHECK ("percent" >= 0 AND "percent" <= 30)
);
