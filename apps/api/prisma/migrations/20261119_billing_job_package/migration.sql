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
INSERT INTO billing.billing_job_package (
  code, company_id, order_id, plan_id, package_type, package_name, status,
  total_jobs, used_jobs, credits_included, duration_days,
  activation_deadline_at, activated_at, expires_at, credits_granted,
  price_vnd, purchased_at, created_at, updated_at
)
SELECT
  'JD-' || CASE p.code
      WHEN 'TIN_DANG' THEN 'ST'
      WHEN 'TIN_DANG_PLUS' THEN 'PL'
      WHEN 'DOANH_NGHIEP' THEN 'DN'
      ELSE 'FR'
    END || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY o.company_id ORDER BY o.created_at)::text, 6, '0'),
  o.company_id,
  o.id,
  p.id,
  CASE p.code
    WHEN 'TIN_DANG' THEN 'STANDARD'
    WHEN 'TIN_DANG_PLUS' THEN 'PLUS'
    WHEN 'DOANH_NGHIEP' THEN 'ENTERPRISE'
    ELSE 'FREE'
  END,
  COALESCE(o.plan_name, p.name, 'Gói tin đăng'),
  CASE
    WHEN p.code IN ('DOANH_NGHIEP', 'KHAM_PHA') THEN 'ACTIVE'
    ELSE 'UNUSED'
  END,
  p.job_post_quota,
  0,
  COALESCE(p.credit_quota, 0),
  COALESCE(p.duration_days, 30),
  CASE
    WHEN p.code IN ('DOANH_NGHIEP', 'KHAM_PHA') THEN NULL
    ELSE COALESCE(o.paid_at, o.created_at) + INTERVAL '30 days'
  END,
  CASE
    WHEN p.code IN ('DOANH_NGHIEP', 'KHAM_PHA') THEN COALESCE(o.paid_at, o.created_at)
    ELSE NULL
  END,
  CASE
    WHEN p.code IN ('DOANH_NGHIEP', 'KHAM_PHA')
      THEN COALESCE(o.paid_at, o.created_at) + (COALESCE(p.duration_days, 30) || ' days')::interval
    ELSE NULL
  END,
  TRUE,
  o.price_vnd_snapshot,
  o.created_at,
  o.created_at,
  now()
FROM billing.billing_order o
JOIN billing.billing_platform_plan p ON p.code = o.plan_code
WHERE o.kind = 'platform' AND o.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM billing.billing_job_package jpk WHERE jpk.order_id = o.id
  );
