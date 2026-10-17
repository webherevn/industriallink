-- Hồ sơ tiềm năng: liên hệ, tổ chức, địa chỉ 34 tỉnh. Các cột đều để trống được.
ALTER TABLE "crm"."crm_lead" ADD COLUMN "zalo" TEXT,
ADD COLUMN "job_title" TEXT,
ADD COLUMN "bank_account" TEXT,
ADD COLUMN "bank_name" TEXT,
ADD COLUMN "founded_on" DATE,
ADD COLUMN "org_type" TEXT,
ADD COLUMN "org_field" TEXT,
ADD COLUMN "revenue_band" TEXT,
ADD COLUMN "country" TEXT DEFAULT 'Việt Nam',
ADD COLUMN "province" TEXT,
ADD COLUMN "ward" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "area_code" TEXT;

ALTER TABLE "crm"."crm_lead" ALTER COLUMN "contact_phone" SET DEFAULT '';
