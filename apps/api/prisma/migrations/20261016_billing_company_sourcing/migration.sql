-- Gán gói Săn cho công ty + đếm hạn mức SuperAdmin + ledger sử dụng.

CREATE TABLE billing.billing_company_sourcing_plan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL UNIQUE,
  plan_id             UUID NOT NULL REFERENCES billing.billing_sourcing_plan(id) ON DELETE RESTRICT,
  starts_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at             TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  note                TEXT,
  positions_used      INTEGER NOT NULL DEFAULT 0,
  search_rounds_used  INTEGER NOT NULL DEFAULT 0,
  shortlists_used     INTEGER NOT NULL DEFAULT 0,
  revisions_used      INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID
);

CREATE INDEX idx_billing_company_sourcing_plan_plan
  ON billing.billing_company_sourcing_plan (plan_id, is_active);

CREATE TABLE billing.billing_sourcing_engagement (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES billing.billing_company_sourcing_plan(id) ON DELETE CASCADE,
  job_id        UUID,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_sourcing_engagement_company
  ON billing.billing_sourcing_engagement (company_id, created_at);
CREATE INDEX idx_billing_sourcing_engagement_assignment
  ON billing.billing_sourcing_engagement (assignment_id);

CREATE TABLE billing.billing_sourcing_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES billing.billing_company_sourcing_plan(id) ON DELETE CASCADE,
  engagement_id UUID REFERENCES billing.billing_sourcing_engagement(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  job_id        UUID,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID
);

CREATE INDEX idx_billing_sourcing_usage_company
  ON billing.billing_sourcing_usage (company_id, created_at);
CREATE INDEX idx_billing_sourcing_usage_assignment_kind
  ON billing.billing_sourcing_usage (assignment_id, kind);
