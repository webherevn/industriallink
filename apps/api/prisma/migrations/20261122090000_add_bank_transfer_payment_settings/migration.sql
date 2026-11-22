-- AlterTable
ALTER TABLE "billing"."billing_payment_setting"
  ADD COLUMN IF NOT EXISTS "bank_bin" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account_number" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_branch" TEXT,
  ADD COLUMN IF NOT EXISTS "transfer_prefix" TEXT NOT NULL DEFAULT 'INLINK',
  ADD COLUMN IF NOT EXISTS "bank_transfer_note" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_webhook_secret_enc" TEXT;
