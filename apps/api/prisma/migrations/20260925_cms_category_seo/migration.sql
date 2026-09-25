-- Category SEO parity with posts/pages (trừ tác giả) + avatar
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "focus_keyword" TEXT;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "canonical_path" TEXT;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "og_title" TEXT;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "og_description" TEXT;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "robots_index" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "robots_follow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "robots_max_image_preview" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_category" ADD COLUMN IF NOT EXISTS "faq_json" JSONB;

UPDATE "cms"."cms_category"
SET
  "robots_index" = CASE WHEN "robots" ILIKE '%noindex%' THEN false ELSE true END,
  "robots_follow" = CASE WHEN "robots" ILIKE '%nofollow%' THEN false ELSE true END
WHERE true;
