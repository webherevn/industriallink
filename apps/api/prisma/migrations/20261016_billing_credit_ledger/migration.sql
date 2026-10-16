-- Sổ Credit dùng khi Top-up thanh toán thành công và khi gán gói có creditQuota.
-- Hai bảng này có trong schema nhưng chưa từng được tạo bởi migration,
-- nên mock success của Top-up báo Prisma P2021.

CREATE TABLE IF NOT EXISTS billing.billing_credit_account (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL,
  company_id         UUID NOT NULL,
  balance            INTEGER NOT NULL DEFAULT 0,
  lifetime_granted   INTEGER NOT NULL DEFAULT 0,
  lifetime_consumed  INTEGER NOT NULL DEFAULT 0,
  lifetime_refunded  INTEGER NOT NULL DEFAULT 0,
  last_activity_at   TIMESTAMP(3),
  created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_credit_account_company_id_key
  ON billing.billing_credit_account (company_id);

CREATE TABLE IF NOT EXISTS billing.billing_credit_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  company_id      UUID NOT NULL,
  account_id      UUID NOT NULL,
  type            TEXT NOT NULL,
  action          TEXT NOT NULL,
  credit_delta    INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  cost_per_unit   INTEGER NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  candidate_id    UUID,
  job_id          UUID,
  connection_id   UUID,
  actor_user_id   UUID,
  actor_email     TEXT,
  policy_snapshot JSONB,
  note            TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  enforced        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS billing_credit_transaction_company_id_created_at_idx
  ON billing.billing_credit_transaction (company_id, created_at);
CREATE INDEX IF NOT EXISTS billing_credit_transaction_type_action_idx
  ON billing.billing_credit_transaction (type, action);
CREATE INDEX IF NOT EXISTS billing_credit_transaction_candidate_id_idx
  ON billing.billing_credit_transaction (candidate_id);
CREATE INDEX IF NOT EXISTS billing_credit_transaction_created_at_idx
  ON billing.billing_credit_transaction (created_at);
