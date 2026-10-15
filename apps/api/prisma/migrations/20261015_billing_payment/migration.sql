-- Migration: Billing — Orders, Payments, Payment Settings (Bước 7)
-- Mục tiêu: cho phép Recruiter mua gói Top-up Credit qua Stripe (sandbox hoặc live).
-- Mode mặc định = 'mock' để dev/test không cần Stripe key thật.

-- =========================================================================
-- 1. PAYMENT SETTINGS (single-row scope="default")
-- =========================================================================
-- Cấu hình gateway & crypto lưu DB. Khi chuyển mode từ Admin UI sẽ ghi đè.
CREATE TABLE billing.billing_payment_setting (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope                       TEXT NOT NULL UNIQUE DEFAULT 'default',

  -- 'mock' = giả lập thanh toán trong app (không cần Stripe key)
  -- 'live' = Stripe sandbox / production
  mode                        TEXT NOT NULL DEFAULT 'mock',

  -- Stripe keys (encrypted AES-256-GCM, định dạng "v1:base64...")
  stripe_publishable_key_enc  TEXT,
  stripe_secret_key_enc       TEXT,
  stripe_webhook_secret_enc   TEXT,

  -- URL trả về sau khi thanh toán xong
  success_url                 TEXT NOT NULL DEFAULT '/recruiter/billing/topup/success?session={CHECKOUT_SESSION_ID}',
  cancel_url                  TEXT NOT NULL DEFAULT '/recruiter/billing/topup/cancel',

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                  UUID
);

-- =========================================================================
-- 2. ORDERS — đơn mua Top-up Credit
-- =========================================================================
-- Mỗi lần Recruiter bấm "Mua" sẽ tạo 1 order (status: pending).
-- Khi Stripe (hoặc mock) xác nhận paid → status='paid' + grantCredit().
CREATE TABLE billing.billing_order (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                TEXT NOT NULL,
  company_id               UUID NOT NULL,

  -- Liên kết gói Top-up (snapshot credit_count & price_vnd tại thời điểm mua)
  topup_id                 UUID NOT NULL REFERENCES billing.billing_credit_topup(id),
  credit_count_snapshot    INTEGER NOT NULL,
  price_vnd_snapshot       BIGINT NOT NULL,

  -- 'pending' = vừa tạo, chờ webhook
  -- 'paid' = đã thanh toán thành công, đã cấp credit
  -- 'failed' = thanh toán thất bại / session hết hạn
  -- 'refunded' = admin hoàn tiền
  status                   TEXT NOT NULL DEFAULT 'pending',

  -- Stripe (hoặc mock) session/payment identifiers
  provider                 TEXT NOT NULL DEFAULT 'stripe',   -- 'stripe' | 'stripe-mock'
  provider_session_id      TEXT,                              -- Stripe Checkout session ID (cs_xxx)
  provider_payment_intent  TEXT,                              -- Stripe PaymentIntent ID (pi_xxx)

  -- User khởi tạo
  created_by_user_id       UUID NOT NULL,
  created_by_email         TEXT,

  -- Timestamps
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                  TIMESTAMPTZ,
  failed_at                TIMESTAMPTZ,
  refunded_at              TIMESTAMPTZ,

  -- Metadata
  note                     TEXT,                              -- lý do fail / refund
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_billing_order_company_created ON billing.billing_order (company_id, created_at DESC);
CREATE INDEX idx_billing_order_status ON billing.billing_order (status);
CREATE UNIQUE INDEX uq_billing_order_provider_session ON billing.billing_order (provider, provider_session_id) WHERE provider_session_id IS NOT NULL;

-- =========================================================================
-- 3. PAYMENTS — log mỗi lần webhook / event từ provider
-- =========================================================================
-- Mục đích: audit + debug. Mỗi event Stripe gửi về sẽ ghi 1 row ở đây.
CREATE TABLE billing.billing_payment (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES billing.billing_order(id) ON DELETE CASCADE,

  -- Stripe event ID (evt_xxx). UNIQUE để chống xử lý trùng.
  provider_event_id        TEXT UNIQUE,

  -- Loại event (vd: 'checkout.session.completed', 'payment_intent.succeeded')
  event_type               TEXT NOT NULL,

  -- 'received' | 'processed' | 'failed' | 'ignored'
  status                   TEXT NOT NULL DEFAULT 'received',

  -- Số tiền (VND integer, snapshot từ event) — null nếu event không kèm amount
  amount_vnd               BIGINT,

  -- Toàn bộ payload từ provider (JSONB) — dùng để debug
  raw_payload              JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Lỗi xử lý (nếu có)
  error_message            TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_payment_order ON billing.billing_payment (order_id, created_at DESC);
CREATE INDEX idx_billing_payment_event_type ON billing.billing_payment (event_type);

-- =========================================================================
-- 4. Seed: payment_setting default row (mock mode)
-- =========================================================================
INSERT INTO billing.billing_payment_setting (scope, mode, success_url, cancel_url)
VALUES ('default', 'mock', '/recruiter/billing/topup/success?session={CHECKOUT_SESSION_ID}', '/recruiter/billing/topup/cancel')
ON CONFLICT (scope) DO NOTHING;
