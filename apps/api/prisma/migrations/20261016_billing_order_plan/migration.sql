-- Đơn thanh toán gói tin / gói Săn, cùng bảng với Top-up.

ALTER TABLE billing.billing_order
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'topup',
  ADD COLUMN plan_code TEXT,
  ADD COLUMN plan_name TEXT;

ALTER TABLE billing.billing_order
  ALTER COLUMN topup_id DROP NOT NULL,
  ALTER COLUMN credit_count_snapshot SET DEFAULT 0;
