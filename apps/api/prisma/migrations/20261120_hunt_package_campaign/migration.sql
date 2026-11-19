-- Refactor luồng "Săn nhân sự" theo mô hình 1-1: Gói săn (BillingHuntPackage) <-> Chiến dịch (HuntCampaign).
-- 1 gói săn chỉ gắn tối đa 1 chiến dịch (hunt_campaign.hunt_package_id UNIQUE).
-- Gói chuyển UNUSED → ACTIVE đồng thời tạo chiến dịch trong 1 transaction,
-- cộng creditsIncluded vào Ví Credit dùng chung (chỉ 1 lần qua cờ credits_granted).

-- ============================================================================
-- 1) Tạo bảng mới
-- ============================================================================
CREATE TABLE IF NOT EXISTS billing.billing_hunt_package (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  company_id            UUID NOT NULL,
  plan_id               UUID NOT NULL,
  order_id              UUID,
  package_type          TEXT NOT NULL DEFAULT 'BASIC',
  package_name          TEXT NOT NULL DEFAULT 'Gói Săn nhân sự',
  status                TEXT NOT NULL DEFAULT 'UNUSED',
  duration_days         INTEGER NOT NULL DEFAULT 30,
  purchased_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  credits_included      INTEGER NOT NULL DEFAULT 0,
  credits_granted       BOOLEAN NOT NULL DEFAULT FALSE,
  total_criteria_edits  INTEGER NOT NULL DEFAULT 0,
  used_criteria_edits   INTEGER NOT NULL DEFAULT 0,
  total_reports         INTEGER NOT NULL DEFAULT 0,
  used_reports          INTEGER NOT NULL DEFAULT 0,
  total_handovers       INTEGER NOT NULL DEFAULT 0,
  used_handovers        INTEGER NOT NULL DEFAULT 0,
  note                  TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_hunt_package_code_key
  ON billing.billing_hunt_package (code);
CREATE INDEX IF NOT EXISTS billing_hunt_package_company_id_status_idx
  ON billing.billing_hunt_package (company_id, status, purchased_at);
CREATE INDEX IF NOT EXISTS billing_hunt_package_plan_id_idx
  ON billing.billing_hunt_package (plan_id);
CREATE INDEX IF NOT EXISTS billing_hunt_package_order_id_idx
  ON billing.billing_hunt_package (order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_hunt_package_plan_id_fkey'
  ) THEN
    ALTER TABLE billing.billing_hunt_package
      ADD CONSTRAINT billing_hunt_package_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES billing.billing_sourcing_plan (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_hunt_package_order_id_fkey'
  ) THEN
    ALTER TABLE billing.billing_hunt_package
      ADD CONSTRAINT billing_hunt_package_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES billing.billing_order (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS billing.hunt_campaign (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,
  company_id        UUID NOT NULL,
  assignment_id     UUID NOT NULL,
  hunt_package_id   UUID NOT NULL,
  job_id            UUID,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS hunt_campaign_code_key ON billing.hunt_campaign (code);
-- Ràng buộc 1-1: 1 gói săn chỉ gắn tối đa 1 chiến dịch.
CREATE UNIQUE INDEX IF NOT EXISTS hunt_campaign_hunt_package_id_key
  ON billing.hunt_campaign (hunt_package_id);
CREATE INDEX IF NOT EXISTS hunt_campaign_company_id_created_at_idx
  ON billing.hunt_campaign (company_id, created_at);
CREATE INDEX IF NOT EXISTS hunt_campaign_assignment_id_idx
  ON billing.hunt_campaign (assignment_id);
CREATE INDEX IF NOT EXISTS hunt_campaign_job_id_idx ON billing.hunt_campaign (job_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hunt_campaign_assignment_id_fkey'
  ) THEN
    ALTER TABLE billing.hunt_campaign
      ADD CONSTRAINT hunt_campaign_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES billing.billing_company_sourcing_plan (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hunt_campaign_hunt_package_id_fkey'
  ) THEN
    ALTER TABLE billing.hunt_campaign
      ADD CONSTRAINT hunt_campaign_hunt_package_id_fkey
      FOREIGN KEY (hunt_package_id) REFERENCES billing.billing_hunt_package (id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hunt_campaign_job_id_fkey'
  ) THEN
    ALTER TABLE billing.hunt_campaign
      ADD CONSTRAINT hunt_campaign_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES recruitment.job (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS billing.hunt_campaign_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL,
  assignment_id  UUID NOT NULL,
  campaign_id    UUID,
  kind           TEXT NOT NULL,
  job_id         UUID,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID
);

CREATE INDEX IF NOT EXISTS hunt_campaign_activity_company_id_created_at_idx
  ON billing.hunt_campaign_activity (company_id, created_at);
CREATE INDEX IF NOT EXISTS hunt_campaign_activity_assignment_id_kind_idx
  ON billing.hunt_campaign_activity (assignment_id, kind);
CREATE INDEX IF NOT EXISTS hunt_campaign_activity_campaign_id_created_at_idx
  ON billing.hunt_campaign_activity (campaign_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hunt_campaign_activity_assignment_id_fkey'
  ) THEN
    ALTER TABLE billing.hunt_campaign_activity
      ADD CONSTRAINT hunt_campaign_activity_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES billing.billing_company_sourcing_plan (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hunt_campaign_activity_campaign_id_fkey'
  ) THEN
    ALTER TABLE billing.hunt_campaign_activity
      ADD CONSTRAINT hunt_campaign_activity_campaign_id_fkey
      FOREIGN KEY (campaign_id) REFERENCES billing.hunt_campaign (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Credit: ghi nhận chiến dịch sinh ra giao dịch (mở hồ sơ ứng viên tiềm năng).
ALTER TABLE billing.billing_credit_transaction
  ADD COLUMN IF NOT EXISTS campaign_id UUID;

CREATE INDEX IF NOT EXISTS billing_credit_transaction_campaign_id_idx
  ON billing.billing_credit_transaction (campaign_id);

-- ============================================================================
-- 2) Backfill từ bảng cũ (billing_sourcing_package / engagement / usage)
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('billing.billing_sourcing_package') IS NULL THEN
    RETURN;
  END IF;

  -- Gói săn: map packageType theo mã gói nền tảng.
  INSERT INTO billing.billing_hunt_package (
    code, company_id, plan_id, package_type, package_name, status,
    duration_days, purchased_at, activated_at, expires_at,
    credits_included, credits_granted,
    total_criteria_edits, used_criteria_edits,
    total_reports, used_reports,
    total_handovers, used_handovers,
    note, created_by, created_at, updated_at
  )
  SELECT
    p.code,
    p.company_id,
    p.plan_id,
    CASE sp.code
      WHEN 'SAN_CO_BAN' THEN 'BASIC'
      WHEN 'SAN_TIEU_CHUAN' THEN 'STANDARD'
      WHEN 'SAN_CHUYEN_SAU' THEN 'DEEP'
      ELSE 'BASIC'
    END,
    sp.name,
    CASE sp.status
      WHEN 'active' THEN 'ACTIVE'
      WHEN 'completed' THEN 'COMPLETED'
      WHEN 'expired' THEN 'EXPIRED'
      ELSE 'UNUSED'
    END,
    sp.duration_days,
    sp.purchased_at,
    sp.activated_at,
    COALESCE(sp.ends_at, sp.reserve_ends_at),
    COALESCE(pl.credit_quota, 0),
    TRUE,
    COALESCE(pl.revision_quota, 0),
    0,
    COALESCE(pl.search_round_quota, 0),
    0,
    CASE WHEN sp.code = 'SAN_CHUYEN_SAU' THEN COALESCE(pl.shortlist_quota, 15) ELSE 0 END,
    0,
    sp.note,
    sp.created_by,
    sp.created_at,
    sp.updated_at
  FROM billing.billing_sourcing_package sp
  JOIN billing.billing_sourcing_plan pl ON pl.id = sp.plan_id
  ON CONFLICT (code) DO NOTHING;

  -- Chiến dịch: 1-1 với gói. Engagement cũ gắn packageId; engagement không gắn gói
  -- sẽ gắn gói UNUSED cũ nhất của cùng công ty (nếu có), ngược lại tạo gói riêng.
  INSERT INTO billing.hunt_campaign (
    code, company_id, assignment_id, hunt_package_id, job_id, title, status,
    created_at, created_by, updated_at
  )
  SELECT
    'HD-' || LPAD(ROW_NUMBER() OVER (PARTITION BY e.company_id ORDER BY e.created_at)::text, 6, '0'),
    e.company_id,
    e.assignment_id,
    hp.id,
    e.job_id,
    e.title,
    e.status,
    e.created_at,
    e.created_by,
    e.updated_at
  FROM billing.billing_sourcing_engagement e
  JOIN billing.billing_hunt_package hp ON hp.company_id = e.company_id AND hp.code = (
      SELECT p2.code FROM billing.billing_sourcing_package p2
      WHERE p2.id = e.package_id
    )
  ON CONFLICT (hunt_package_id) DO NOTHING;

  -- Ledger hoạt động: gắn campaignId theo engagement cũ.
  IF to_regclass('billing.billing_sourcing_usage') IS NOT NULL THEN
    INSERT INTO billing.hunt_campaign_activity (
      id, company_id, assignment_id, campaign_id, kind, job_id, note, created_at, created_by
    )
    SELECT
      u.id,
      u.company_id,
      u.assignment_id,
      hc.id,
      u.kind,
      u.job_id,
      u.note,
      u.created_at,
      u.created_by
    FROM billing.billing_sourcing_usage u
    JOIN billing.hunt_campaign hc ON hc.job_id = u.job_id AND hc.company_id = u.company_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 3) Xoá bảng cũ (sau khi đã backfill)
-- ============================================================================
DROP TABLE IF EXISTS billing.billing_sourcing_usage CASCADE;
DROP TABLE IF EXISTS billing.billing_sourcing_engagement CASCADE;
DROP TABLE IF EXISTS billing.billing_sourcing_package CASCADE;
