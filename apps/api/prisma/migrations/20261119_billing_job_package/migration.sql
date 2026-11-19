-- Gói tin đăng multi-active: mỗi lần mua 1 gói = 1 bản ghi độc lập.
-- Nhiều gói cùng ACTIVE; mỗi gói dùng lượt đăng cho 1 tin riêng (Job.jobPackageId).

CREATE TABLE IF NOT EXISTS billing.billing_job_package (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  company_id            UUID NOT NULL,
  order_id              UUID,
  plan_id               UUID,
  package_type          TEXT NOT NULL,
  package_name          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'UNUSED',
  total_jobs            INTEGER,
  used_jobs             INTEGER NOT NULL DEFAULT 0,
  credits_included      INTEGER NOT NULL DEFAULT 0,
  duration_days         INTEGER NOT NULL DEFAULT 30,
  activation_deadline_at TIMESTAMPTZ,
  activated_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  credits_granted       BOOLEAN NOT NULL DEFAULT FALSE,
  price_vnd             BIGINT NOT NULL DEFAULT 0,
  purchased_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_job_package_code_key
  ON billing.billing_job_package (code);
CREATE INDEX IF NOT EXISTS billing_job_package_company_id_status_idx
  ON billing.billing_job_package (company_id, status);
CREATE INDEX IF NOT EXISTS billing_job_package_order_id_idx
  ON billing.billing_job_package (order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_job_package_plan_id_fkey'
  ) THEN
    ALTER TABLE billing.billing_job_package
      ADD CONSTRAINT billing_job_package_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES billing.billing_platform_plan (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_job_package_order_id_fkey'
  ) THEN
    ALTER TABLE billing.billing_job_package
      ADD CONSTRAINT billing_job_package_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES billing.billing_order (id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE recruitment.job
  ADD COLUMN IF NOT EXISTS job_package_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_job_package_id_fkey'
  ) THEN
    ALTER TABLE recruitment.job
      ADD CONSTRAINT job_job_package_id_fkey
      FOREIGN KEY (job_package_id) REFERENCES billing.billing_job_package (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_job_package_id_idx ON recruitment.job (job_package_id);

-- Lô Credit (FIFO theo hạn gói).
CREATE TABLE IF NOT EXISTS billing.billing_credit_lot (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL,
  account_id  UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_key  TEXT,
  granted     INTEGER NOT NULL DEFAULT 0,
  consumed    INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_credit_lot_company_id_expires_at_idx
  ON billing.billing_credit_lot (company_id, expires_at);
CREATE INDEX IF NOT EXISTS billing_credit_lot_account_id_idx
  ON billing.billing_credit_lot (account_id);

-- Backfill: mỗi đơn nền tảng đã trả (kind='platform', status='paid') = 1 gói tin đăng.
-- creditsGranted = TRUE vì hệ thống cũ đã cấp Credit lúc thanh toán.
--
-- LƯU Ý MÃ GÓI: `billing_job_package.code` là UNIQUE TOÀN CỤC (không phải theo công ty).
-- Vì vậy phải đánh số theo TIỀN TỐ gói (ST/PL/DN/FR) và tiếp tục từ mã lớn nhất đã tồn tại
-- (gói do ứng dụng tạo lúc thanh toán), nếu không sẽ trùng `billing_job_package_code_key`.
WITH src AS (
  SELECT
    o.id                  AS order_id,
    o.company_id          AS company_id,
    o.plan_name           AS order_plan_name,
    o.price_vnd_snapshot  AS price_vnd_snapshot,
    o.paid_at             AS paid_at,
    o.created_at          AS created_at,
    p.id                  AS plan_id,
    p.name                AS plan_name,
    p.job_post_quota      AS job_post_quota,
    p.credit_quota        AS credit_quota,
    p.duration_days       AS duration_days,
    CASE o.plan_code
      WHEN 'TIN_DANG' THEN 'STANDARD'
      WHEN 'TIN_DANG_PLUS' THEN 'PLUS'
      WHEN 'DOANH_NGHIEP' THEN 'ENTERPRISE'
      WHEN 'ENTERPRISE' THEN 'ENTERPRISE'
      ELSE 'FREE'
    END AS package_type,
    CASE o.plan_code
      WHEN 'TIN_DANG' THEN 'ST'
      WHEN 'TIN_DANG_PLUS' THEN 'PL'
      WHEN 'DOANH_NGHIEP' THEN 'DN'
      WHEN 'ENTERPRISE' THEN 'DN'
      ELSE 'FR'
    END AS prefix,
    CASE o.plan_code
      WHEN 'KHAM_PHA' THEN TRUE
      WHEN 'DOANH_NGHIEP' THEN TRUE
      WHEN 'ENTERPRISE' THEN TRUE
      ELSE FALSE
    END AS auto_activate
  FROM billing.billing_order o
  JOIN billing.billing_platform_plan p ON p.code = o.plan_code
  WHERE o.kind = 'platform' AND o.status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM billing.billing_job_package jpk WHERE jpk.order_id = o.id
    )
),
numbered AS (
  SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.prefix ORDER BY s.created_at, s.order_id) AS rn
  FROM src s
),
existing_max AS (
  SELECT
    split_part(code, '-', 2) AS prefix,
    COALESCE(MAX((substring(code from '-(\d+)$'))::int), 0) AS max_n
  FROM billing.billing_job_package
  GROUP BY 1
)
INSERT INTO billing.billing_job_package (
  code, company_id, order_id, plan_id, package_type, package_name, status,
  total_jobs, used_jobs, credits_included, duration_days,
  activation_deadline_at, activated_at, expires_at, credits_granted,
  price_vnd, purchased_at, created_at, updated_at
)
SELECT
  'JD-' || n.prefix || '-' || LPAD((COALESCE(e.max_n, 0) + n.rn)::text, 6, '0'),
  n.company_id,
  n.order_id,
  n.plan_id,
  n.package_type,
  COALESCE(n.order_plan_name, n.plan_name, 'Gói tin đăng'),
  CASE
    WHEN n.auto_activate THEN 'ACTIVE'
    ELSE 'UNUSED'
  END,
  n.job_post_quota,
  0,
  COALESCE(n.credit_quota, 0),
  COALESCE(n.duration_days, 30),
  CASE
    WHEN n.auto_activate THEN NULL
    ELSE COALESCE(n.paid_at, n.created_at) + INTERVAL '30 days'
  END,
  CASE
    WHEN n.auto_activate THEN COALESCE(n.paid_at, n.created_at)
    ELSE NULL
  END,
  CASE
    WHEN n.auto_activate
      THEN COALESCE(n.paid_at, n.created_at) + (COALESCE(n.duration_days, 30) || ' days')::interval
    ELSE NULL
  END,
  TRUE,
  n.price_vnd_snapshot,
  n.created_at,
  n.created_at,
  now()
FROM numbered n
LEFT JOIN existing_max e ON e.prefix = n.prefix
ON CONFLICT (code) DO NOTHING;
