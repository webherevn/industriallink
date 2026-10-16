-- Ghi số hóa đơn đã xuất trên deal. Không tạo công nợ, không gán gói.
ALTER TABLE "crm"."crm_deal"
  ADD COLUMN IF NOT EXISTS "invoice_status" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "invoice_number" TEXT,
  ADD COLUMN IF NOT EXISTS "invoice_issued_at" TIMESTAMPTZ;
