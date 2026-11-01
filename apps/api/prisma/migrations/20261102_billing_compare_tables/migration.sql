-- Bảng so sánh gói trên /bang-gia. Null = giữ bảng tự sinh từ giá và hạn mức.

ALTER TABLE billing.billing_page_content
  ADD COLUMN IF NOT EXISTS compare_tables JSONB;
