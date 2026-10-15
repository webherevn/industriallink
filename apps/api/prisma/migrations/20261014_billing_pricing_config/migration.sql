-- Migration: Billing & Pricing Configuration (LOGIC FINAL V3)
-- Module cấu hình giá/quota/credit — quản lý từ /admin/billing (SuperAdmin).
-- Không hardcode giá trong code, dùng VND integer làm đơn vị lưu trữ.

-- =========================================================================
-- 1. SCHEMA
-- =========================================================================
CREATE SCHEMA IF NOT EXISTS billing;

-- =========================================================================
-- 2. PLATFORM PLAN (Tầng 1: 5 gói nền tảng)
-- =========================================================================
CREATE TABLE billing.billing_platform_plan (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  price_vnd       BIGINT NOT NULL,
  billing_unit    TEXT NOT NULL,            -- per_jd | per_month
  duration_days   INTEGER,                  -- null = không giới hạn (gói tháng)
  job_post_quota  INTEGER,                  -- null = unlimited
  credit_quota    INTEGER,                  -- null = theo hợp đồng
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  features        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID
);

CREATE INDEX idx_billing_platform_plan_active ON billing.billing_platform_plan (is_active, sort_order);

-- =========================================================================
-- 3. SOURCING PLAN (Tầng 2: 3 gói Săn nhân sự)
-- =========================================================================
CREATE TABLE billing.billing_sourcing_plan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  fee_vnd             BIGINT NOT NULL,
  position_quota      INTEGER,
  search_round_quota  INTEGER,
  shortlist_quota     INTEGER,
  revision_quota      INTEGER,
  service_scope       JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_featured         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID
);

CREATE INDEX idx_billing_sourcing_plan_active ON billing.billing_sourcing_plan (is_active, sort_order);

-- =========================================================================
-- 4. CREDIT TOP-UP
-- =========================================================================
CREATE TABLE billing.billing_credit_topup (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  credit_count  INTEGER NOT NULL,
  price_vnd     BIGINT NOT NULL,
  unit_price_vnd BIGINT NOT NULL,           -- = price_vnd / credit_count (lưu sẵn)
  badge         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID
);

CREATE INDEX idx_billing_credit_topup_active ON billing.billing_credit_topup (is_active, sort_order);

-- =========================================================================
-- 5. CREDIT POLICY (quy tắc trừ Credit, single-row scope="default")
-- =========================================================================
CREATE TABLE billing.billing_credit_policy (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                           TEXT NOT NULL UNIQUE DEFAULT 'default',
  cost_per_profile                INTEGER NOT NULL DEFAULT 1,
  cost_per_reopen                 INTEGER NOT NULL DEFAULT 0,
  cost_per_applicant              INTEGER NOT NULL DEFAULT 0,
  cost_per_contact_potential      INTEGER NOT NULL DEFAULT 0,
  cost_per_contact_applicant      INTEGER NOT NULL DEFAULT 0,
  cost_per_match_summary          INTEGER NOT NULL DEFAULT 0,
  allow_auto_purchase             BOOLEAN NOT NULL DEFAULT false,
  default_budget_vnd              BIGINT,
  warn_when_below_percent         INTEGER NOT NULL DEFAULT 20,
  allow_budget_overspend          BOOLEAN NOT NULL DEFAULT false,
  expire_when_inactive            BOOLEAN NOT NULL DEFAULT false,
  inactive_days                   INTEGER,
  allow_refund                    BOOLEAN NOT NULL DEFAULT false,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                      UUID,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      UUID
);

-- =========================================================================
-- 6. CURRENCY CONFIG (hiển thị & quy đổi, single-row scope="default")
-- =========================================================================
CREATE TABLE billing.billing_currency_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                       TEXT NOT NULL UNIQUE DEFAULT 'default',
  currency_code               TEXT NOT NULL DEFAULT 'VND',
  display_symbol              TEXT NOT NULL DEFAULT '$',
  symbol_before               BOOLEAN NOT NULL DEFAULT true,
  use_thousands_separator     BOOLEAN NOT NULL DEFAULT true,
  thousands_separator         TEXT NOT NULL DEFAULT ',',
  decimal_digits              INTEGER NOT NULL DEFAULT 0,
  show_reference_usd          BOOLEAN NOT NULL DEFAULT false,
  reference_usd_rate          BIGINT,
  usd_to_vnd_rate_hundredths  BIGINT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  UUID
);

-- =========================================================================
-- 7. AUDIT LOG
-- =========================================================================
CREATE TABLE billing.billing_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity      TEXT NOT NULL,
  entity_key  TEXT NOT NULL,
  action      TEXT NOT NULL,
  diff        JSONB NOT NULL,
  actor_id    UUID,
  actor_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_audit_entity ON billing.billing_audit_log (entity, entity_key);
CREATE INDEX idx_billing_audit_created ON billing.billing_audit_log (created_at);
