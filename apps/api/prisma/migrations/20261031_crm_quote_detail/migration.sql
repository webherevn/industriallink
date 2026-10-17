-- Tờ báo giá: ngày lập, hạn hiệu lực, tình trạng, địa chỉ và cơ hội.
ALTER TABLE "crm"."crm_quote" ADD COLUMN "deal_id" UUID,
ADD COLUMN "quoted_on" DATE,
ADD COLUMN "valid_until" DATE,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN "address" TEXT;

UPDATE "crm"."crm_quote"
SET "quoted_on" = (("created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
WHERE "quoted_on" IS NULL;

ALTER TABLE "crm"."crm_quote" ALTER COLUMN "quoted_on" SET NOT NULL;
