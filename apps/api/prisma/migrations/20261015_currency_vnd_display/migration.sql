-- Hiển thị giá dạng 1,225,000VNĐ (ký hiệu sau số), không dùng $ phía trước.
ALTER TABLE billing.billing_currency_config
  ALTER COLUMN display_symbol SET DEFAULT 'VNĐ',
  ALTER COLUMN symbol_before SET DEFAULT false;

UPDATE billing.billing_currency_config
SET
  display_symbol = 'VNĐ',
  symbol_before = false,
  updated_at = now()
WHERE scope = 'default';
