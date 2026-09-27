-- JSON-LD tùy biến theo từng bài/trang và trang chủ.
ALTER TABLE "cms"."cms_post"
  ADD COLUMN IF NOT EXISTS "custom_schema" TEXT;

ALTER TABLE "cms"."cms_homepage_settings"
  ADD COLUMN IF NOT EXISTS "custom_schema" TEXT;
