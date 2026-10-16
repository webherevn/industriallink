-- Đợt 1 CRM: lead và một phễu bán gói.
-- Không tạo ví mới, không hóa đơn, không hoa hồng, không bảo hành săn.
-- Deal không gán gói. Gán gói vẫn chỉ từ đơn billing đã thanh toán hoặc SuperAdmin.

CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE crm.crm_pipeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crm.crm_stage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES crm.crm_pipeline(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 1,
  win_probability INTEGER NOT NULL DEFAULT 10,
  UNIQUE (pipeline_id, code)
);

CREATE TABLE crm.crm_lead (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_code     TEXT NOT NULL UNIQUE,
  company_name  TEXT NOT NULL,
  tax_code      TEXT,
  contact_name  TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  industry      TEXT,
  company_id    UUID,
  status        TEXT NOT NULL DEFAULT 'open',
  owner_user_id UUID NOT NULL,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX crm_lead_tax_code_idx ON crm.crm_lead (tax_code);
CREATE INDEX crm_lead_phone_idx ON crm.crm_lead (contact_phone);
CREATE INDEX crm_lead_owner_status_idx ON crm.crm_lead (owner_user_id, status);

CREATE TABLE crm.crm_deal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_code         TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  lead_id           UUID NOT NULL REFERENCES crm.crm_lead(id),
  company_id        UUID,
  pipeline_id       UUID NOT NULL REFERENCES crm.crm_pipeline(id),
  stage_id          UUID NOT NULL REFERENCES crm.crm_stage(id),
  plan_kind         TEXT,
  plan_code         TEXT,
  list_price_vnd    BIGINT,
  billing_order_id  UUID,
  provision_state   TEXT NOT NULL DEFAULT 'not_provisioned',
  owner_user_id     UUID NOT NULL,
  won_at            TIMESTAMP(3),
  lost_at           TIMESTAMP(3),
  lost_reason       TEXT,
  created_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX crm_deal_owner_stage_idx ON crm.crm_deal (owner_user_id, stage_id);
CREATE INDEX crm_deal_company_idx ON crm.crm_deal (company_id);

CREATE TABLE crm.crm_activity (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID REFERENCES crm.crm_lead(id),
  deal_id             UUID REFERENCES crm.crm_deal(id),
  activity_type       TEXT NOT NULL,
  summary             TEXT NOT NULL,
  created_by_user_id  UUID NOT NULL,
  created_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX crm_activity_lead_created_idx ON crm.crm_activity (lead_id, created_at);

WITH pipeline AS (
  INSERT INTO crm.crm_pipeline (code, name, description)
  VALUES (
    'ban_goi',
    'Bán gói dịch vụ',
    'Gói tin và gói Săn đang bán trên inlink. Chuyển trạng thái không gán gói.'
  )
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO crm.crm_stage (pipeline_id, code, name, sort_order, win_probability)
SELECT pipeline.id, stage.code, stage.name, stage.sort_order, stage.win_probability
FROM pipeline
CROSS JOIN (
  VALUES
    ('new', 'Lead mới', 1, 10),
    ('consulting', 'Đã tư vấn', 2, 30),
    ('quoted', 'Đã gửi báo giá', 3, 60),
    ('awaiting_payment', 'Chờ thanh toán', 4, 80),
    ('won', 'Đã chốt', 5, 100),
    ('lost', 'Không chốt', 6, 0)
) AS stage(code, name, sort_order, win_probability)
ON CONFLICT (pipeline_id, code) DO NOTHING;
