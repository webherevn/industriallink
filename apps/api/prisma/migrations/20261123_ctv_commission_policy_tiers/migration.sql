-- Chính sách & Tính toán Hoa hồng CTV — mô hình 3 cấp bậc doanh số thực thu/tháng.
--
-- Bảng mới:
--   crm.ctv_commission_policy      — cấu hình chính sách theo phiên bản
--   crm.ctv_commission_tier        — 3 cấp bậc (BASIC/SILVER/GOLD) của 1 policy
--   crm.ctv_monthly_statement      — kỳ đối soát tháng của 1 CTV
--   crm.ctv_commission_item        — chi tiết từng giao dịch hợp lệ trong kỳ
--
-- Bảng sửa:
--   company.referred_by_ctv_id / attributed_at / attribution_source
--     → ghi nhận khách hàng trọn đời (1 KH — 1 CTV). Không ghi đè CTV đã gán.

-- ── Enum trạng thái chính sách ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CtvCommissionPolicyStatus' AND n.nspname = 'crm'
  ) THEN
    CREATE TYPE "crm"."CtvCommissionPolicyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ARCHIVED');
  END IF;
END
$$;

-- ── Bảng chính sách ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm"."ctv_commission_policy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "crm"."CtvCommissionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effective_from" TIMESTAMP(3) NOT NULL,
  "include_job_posting" BOOLEAN NOT NULL DEFAULT TRUE,
  "include_hunt_package" BOOLEAN NOT NULL DEFAULT TRUE,
  -- Nạp thêm Credit mặc định KHÔNG tính hoa hồng, KHÔNG cộng doanh số xét hạng.
  "include_credit_topup" BOOLEAN NOT NULL DEFAULT FALSE,
  -- Tính trên doanh thu thực thu chưa VAT (sau chiết khấu).
  "exclude_vat" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "ctv_commission_policy_name_version_key" UNIQUE ("name", "version")
);

CREATE INDEX IF NOT EXISTS "ctv_commission_policy_status_effective_from_idx"
  ON "crm"."ctv_commission_policy" ("status", "effective_from");

-- ── Bảng cấp bậc ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm"."ctv_commission_tier" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "policy_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  -- Cận dưới (gồm). null = bậc đầu tiên bắt đầu từ 0.
  "min_monthly_revenue" BIGINT NOT NULL,
  -- Cận trên (không gồm). null = không giới hạn trên.
  "max_monthly_revenue" BIGINT,
  "rate_percent" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ctv_commission_tier_policy_id_code_key" UNIQUE ("policy_id", "code")
);

CREATE INDEX IF NOT EXISTS "ctv_commission_tier_policy_id_sort_order_idx"
  ON "crm"."ctv_commission_tier" ("policy_id", "sort_order");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ctv_commission_tier_policy_id_fkey'
  ) THEN
    ALTER TABLE "crm"."ctv_commission_tier"
      ADD CONSTRAINT "ctv_commission_tier_policy_id_fkey"
      FOREIGN KEY ("policy_id") REFERENCES "crm"."ctv_commission_policy"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END
$$;

-- ── Bảng kỳ đối soát tháng ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm"."ctv_monthly_statement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ctv_id" UUID NOT NULL,
  -- Tháng dương lịch giờ Việt Nam, dạng YYYY-MM.
  "year_month" TEXT NOT NULL,
  "policy_id" UUID NOT NULL,
  "total_eligible_revenue" BIGINT NOT NULL DEFAULT 0,
  "achieved_tier_code" TEXT,
  "achieved_tier_name" TEXT,
  "applied_rate_percent" INTEGER,
  "gross_commission" BIGINT NOT NULL DEFAULT 0,
  -- Điều chỉnh âm khi hoàn tiền của kỳ đã chốt.
  "adjustment_amount" BIGINT NOT NULL DEFAULT 0,
  "final_commission" BIGINT NOT NULL DEFAULT 0,
  -- OPEN | RECONCILED | PAID
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reconciled_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- @updatedAt do Prisma quản lý, không đặt default ở DB.
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ctv_monthly_statement_ctv_id_year_month_key" UNIQUE ("ctv_id", "year_month")
);

CREATE INDEX IF NOT EXISTS "ctv_monthly_statement_year_month_status_idx"
  ON "crm"."ctv_monthly_statement" ("year_month", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctv_monthly_statement_ctv_id_fkey') THEN
    ALTER TABLE "crm"."ctv_monthly_statement"
      ADD CONSTRAINT "ctv_monthly_statement_ctv_id_fkey"
      FOREIGN KEY ("ctv_id") REFERENCES "crm"."crm_partner"("id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctv_monthly_statement_policy_id_fkey') THEN
    ALTER TABLE "crm"."ctv_monthly_statement"
      ADD CONSTRAINT "ctv_monthly_statement_policy_id_fkey"
      FOREIGN KEY ("policy_id") REFERENCES "crm"."ctv_commission_policy"("id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$$;

-- ── Bảng chi tiết giao dịch hợp lệ ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "crm"."ctv_commission_item" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "statement_id" UUID NOT NULL,
  "ctv_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "billing_order_id" UUID NOT NULL,
  -- JOB_PACKAGE | HUNT_PACKAGE | UPGRADE_DELTA | CREDIT_TOPUP
  "product_type" TEXT NOT NULL,
  "plan_code" TEXT,
  "plan_name" TEXT,
  -- Tổng tiền khách chuyển (gồm VAT).
  "paid_amount_gross" BIGINT NOT NULL DEFAULT 0,
  "vat_amount" BIGINT NOT NULL DEFAULT 0,
  "discount_amount" BIGINT NOT NULL DEFAULT 0,
  -- Doanh thu thực thu chưa VAT sau chiết khấu (cơ sở tính hoa hồng).
  "eligible_revenue" BIGINT NOT NULL DEFAULT 0,
  "applied_rate_percent" INTEGER NOT NULL DEFAULT 0,
  "commission_amount" BIGINT NOT NULL DEFAULT 0,
  -- RECORDED | VOIDED | ADJUSTED_NEXT_PERIOD
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "year_month" TEXT NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- @updatedAt do Prisma quản lý, không đặt default ở DB.
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ctv_commission_item_billing_order_id_year_month_key"
    UNIQUE ("billing_order_id", "year_month")
);

CREATE INDEX IF NOT EXISTS "ctv_commission_item_ctv_id_year_month_status_idx"
  ON "crm"."ctv_commission_item" ("ctv_id", "year_month", "status");
CREATE INDEX IF NOT EXISTS "ctv_commission_item_statement_id_idx"
  ON "crm"."ctv_commission_item" ("statement_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctv_commission_item_statement_id_fkey') THEN
    ALTER TABLE "crm"."ctv_commission_item"
      ADD CONSTRAINT "ctv_commission_item_statement_id_fkey"
      FOREIGN KEY ("statement_id") REFERENCES "crm"."ctv_monthly_statement"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ctv_commission_item_ctv_id_fkey') THEN
    ALTER TABLE "crm"."ctv_commission_item"
      ADD CONSTRAINT "ctv_commission_item_ctv_id_fkey"
      FOREIGN KEY ("ctv_id") REFERENCES "crm"."crm_partner"("id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$$;

-- ── Company: ghi nhận CTV trọn đời ────────────────────────────────────────
ALTER TABLE "company"."company" ADD COLUMN IF NOT EXISTS "referred_by_ctv_id" UUID;
ALTER TABLE "company"."company" ADD COLUMN IF NOT EXISTS "attributed_at" TIMESTAMP(3);
ALTER TABLE "company"."company" ADD COLUMN IF NOT EXISTS "attribution_source" TEXT;

CREATE INDEX IF NOT EXISTS "company_referred_by_ctv_id_idx"
  ON "company"."company" ("referred_by_ctv_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_referred_by_ctv_id_fkey'
  ) THEN
    ALTER TABLE "company"."company"
      ADD CONSTRAINT "company_referred_by_ctv_id_fkey"
      FOREIGN KEY ("referred_by_ctv_id") REFERENCES "crm"."crm_partner"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END
$$;

-- ── Seed: 1 chính sách ACTIVE mặc định với 3 cấp bậc ─────────────────────
-- Cơ bản: 0 → < 10.000.000đ = 15%
-- Bạc:    10.000.000đ → < 30.000.000đ = 20%
-- Vàng:   từ 30.000.000đ trở lên = 25%
DO $$
DECLARE
  v_policy_id UUID;
  v_creator UUID;
BEGIN
  -- Người tạo: lấy SuperAdmin đầu tiên, nếu không có thì để NULL (FK cho phép).
  SELECT id INTO v_creator FROM "identity"."user" WHERE role = 'super_admin' LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM "crm"."ctv_commission_policy" WHERE name = 'Chính sách hoa hồng CTV Inlink'
  ) THEN
    INSERT INTO "crm"."ctv_commission_policy" (
      "id", "name", "version", "status", "effective_from",
      "include_job_posting", "include_hunt_package", "include_credit_topup", "exclude_vat",
      "created_by_user_id", "created_at", "note"
    ) VALUES (
      gen_random_uuid(),
      'Chính sách hoa hồng CTV Inlink',
      1,
      'ACTIVE',
      date_trunc('day', CURRENT_TIMESTAMP),
      TRUE, TRUE, FALSE, TRUE,
      COALESCE(v_creator, gen_random_uuid()),
      CURRENT_TIMESTAMP,
      'Chính sách mặc định: 3 cấp bậc theo doanh số thực thu/tháng. Bậc đạt được áp dụng cho toàn bộ doanh thu hợp lệ trong tháng.'
    )
    RETURNING id INTO v_policy_id;

    INSERT INTO "crm"."ctv_commission_tier"
      ("policy_id", "code", "name", "min_monthly_revenue", "max_monthly_revenue", "rate_percent", "sort_order")
    VALUES
      (v_policy_id, 'BASIC',  'Cơ bản', 0,          10000000, 15, 1),
      (v_policy_id, 'SILVER', 'Bạc',    10000000,   30000000, 20, 2),
      (v_policy_id, 'GOLD',   'Vàng',   30000000,   NULL,     25, 3);
  END IF;
END
$$;
