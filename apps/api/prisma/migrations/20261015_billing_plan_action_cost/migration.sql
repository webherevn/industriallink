-- Migration: Per-plan action costs + company plan assignment (Bước 9)
-- SuperAdmin chỉnh cost-per-action / quota / thời hạn theo từng gói, không hardcode.
-- Trừ Credit: gói đang gán cho công ty → fallback BillingCreditPolicy global.

-- =========================================================================
-- 1. COST PER ACTION THEO GÓI NỀN TẢNG
-- =========================================================================
CREATE TABLE billing.billing_plan_action_cost (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES billing.billing_platform_plan(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  cost        INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_plan_action_cost UNIQUE (plan_id, action)
);

CREATE INDEX idx_billing_plan_action_cost_plan
  ON billing.billing_plan_action_cost (plan_id, is_active);

-- Seed mặc định từ policy global (nếu đã có), không ghi đè nếu SuperAdmin đã set sau này.
INSERT INTO billing.billing_plan_action_cost (plan_id, action, cost, is_active)
SELECT
  p.id,
  x.action,
  x.cost,
  true
FROM billing.billing_platform_plan p
CROSS JOIN LATERAL (
  SELECT 'view_profile' AS action, COALESCE(pol.cost_per_profile, 1) AS cost
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
  UNION ALL
  SELECT 'reopen_profile', COALESCE(pol.cost_per_reopen, 0)
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
  UNION ALL
  SELECT 'view_applicant', COALESCE(pol.cost_per_applicant, 0)
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
  UNION ALL
  SELECT 'contact_potential', COALESCE(pol.cost_per_contact_potential, 0)
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
  UNION ALL
  SELECT 'contact_applicant', COALESCE(pol.cost_per_contact_applicant, 0)
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
  UNION ALL
  SELECT 'view_match_summary', COALESCE(pol.cost_per_match_summary, 0)
  FROM billing.billing_credit_policy pol WHERE pol.scope = 'default'
) x
ON CONFLICT (plan_id, action) DO NOTHING;

-- Nếu chưa có policy row, seed cost mặc định V1 (1 / 0 / 0 / 0 / 0 / 0).
INSERT INTO billing.billing_plan_action_cost (plan_id, action, cost, is_active)
SELECT p.id, x.action, x.cost, true
FROM billing.billing_platform_plan p
CROSS JOIN (
  VALUES
    ('view_profile', 1),
    ('reopen_profile', 0),
    ('view_applicant', 0),
    ('contact_potential', 0),
    ('contact_applicant', 0),
    ('view_match_summary', 0)
) AS x(action, cost)
ON CONFLICT (plan_id, action) DO NOTHING;

-- =========================================================================
-- 2. GÁN GÓI CHO CÔNG TY (1 công ty = 1 gói)
-- =========================================================================
CREATE TABLE billing.billing_company_plan (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL UNIQUE,
  plan_id     UUID NOT NULL REFERENCES billing.billing_platform_plan(id) ON DELETE RESTRICT,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID
);

CREATE INDEX idx_billing_company_plan_plan
  ON billing.billing_company_plan (plan_id, is_active);
