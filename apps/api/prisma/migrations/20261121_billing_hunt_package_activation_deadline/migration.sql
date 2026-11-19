-- P2 — Gói Săn chờ kích hoạt (UNUSED) có hạn chót riêng (B6).
-- Gói đã mua nhưng chưa kích hoạt → sau 30 ngày chuyển EXPIRED,
-- NTD không mất tiền âm thầm và UI hiển thị rõ "gói chờ kích hoạt".

ALTER TABLE billing.billing_hunt_package
  ADD COLUMN IF NOT EXISTS activation_deadline_at TIMESTAMPTZ;

-- Gói UNUSED đã có sẵn (mua trước khi có cột) → đặt hạn kích hoạt = purchasedAt + 30 ngày.
UPDATE billing.billing_hunt_package
SET activation_deadline_at = purchased_at + INTERVAL '30 days'
WHERE status = 'UNUSED' AND activation_deadline_at IS NULL;

CREATE INDEX IF NOT EXISTS billing_hunt_package_activation_deadline_idx
  ON billing.billing_hunt_package (status, activation_deadline_at);
