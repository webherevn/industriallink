-- Xác thực CCCD 2 mặt + tài khoản ngân hàng cho cộng tác viên.
-- Ảnh CCCD nằm trong Object Storage private, DB chỉ lưu key. Không có URL công khai.

-- Enum có thể đã tồn tại nếu lần deploy trước chạy dở → dùng block IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrmKycStatus') THEN
    CREATE TYPE "crm"."CrmKycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
  END IF;
END
$$;

-- Hồ sơ KYC: 1 hồ sơ cho 1 cộng tác viên.
CREATE TABLE IF NOT EXISTS "crm"."crm_partner_kyc" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" UUID NOT NULL,
  "status" "crm"."CrmKycStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "full_name" TEXT,
  "id_number" TEXT,
  "id_issued_date" TIMESTAMP(3),
  "id_issued_place" TEXT,
  "personal_tax_code" TEXT,
  "phone" TEXT,
  "cccd_front_key" TEXT,
  "cccd_back_key" TEXT,
  "bank_code" TEXT,
  "bank_name" TEXT,
  "bank_account_number" TEXT,
  "bank_account_holder" TEXT,
  "kyc_submitted_at" TIMESTAMP(3),
  "kyc_reviewed_at" TIMESTAMP(3),
  "kyc_reviewed_by_id" UUID,
  "kyc_reject_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_partner_kyc_partner_id_key" ON "crm"."crm_partner_kyc" ("partner_id");
CREATE INDEX IF NOT EXISTS "crm_partner_kyc_status_idx" ON "crm"."crm_partner_kyc" ("status");
CREATE INDEX IF NOT EXISTS "crm_partner_kyc_id_number_idx" ON "crm"."crm_partner_kyc" ("id_number");

-- Khóa ngoại tới cộng tác viên — đặt tên constraint theo chuẩn Prisma.
-- ON UPDATE CASCADE ON DELETE RESTRICT là mặc định Prisma cho quan hệ bắt buộc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_partner_kyc_partner_id_fkey'
  ) THEN
    ALTER TABLE "crm"."crm_partner_kyc"
      ADD CONSTRAINT "crm_partner_kyc_partner_id_fkey"
      FOREIGN KEY ("partner_id") REFERENCES "crm"."crm_partner"("id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- Khóa MST: vòng đời + hạn 30 ngày. MST cũ đang PROTECTING được đặt hạn = created_at + 30 ngày.
ALTER TABLE "crm"."crm_partner_claim" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PROTECTING';
ALTER TABLE "crm"."crm_partner_claim" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- Backfill: hạn bảo vệ = created_at + 30 ngày.
-- created_at có thể NULL ở dữ liệu cũ → dùng COALESCE(now()) để không để lại NULL.
UPDATE "crm"."crm_partner_claim"
SET "expires_at" = COALESCE("created_at", CURRENT_TIMESTAMP) + INTERVAL '30 days'
WHERE "expires_at" IS NULL;

-- NOT NULL chỉ set khi không còn dòng NULL (an toàn nếu backfill bị bỏ sót).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "crm"."crm_partner_claim" WHERE "expires_at" IS NULL) THEN
    ALTER TABLE "crm"."crm_partner_claim" ALTER COLUMN "expires_at" SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "crm_partner_claim_status_expires_at_idx" ON "crm"."crm_partner_claim" ("status", "expires_at");

-- Kỳ chi trả: ghi đủ trường kế toán (gross / thuế TNCN / thực nhận / UNC).
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN IF NOT EXISTS "gross_amount_vnd" BIGINT;
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN IF NOT EXISTS "pit_tax_amount_vnd" BIGINT;
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN IF NOT EXISTS "net_paid_amount_vnd" BIGINT;
ALTER TABLE "crm"."crm_commission_period" ADD COLUMN IF NOT EXISTS "transfer_ref" TEXT;
