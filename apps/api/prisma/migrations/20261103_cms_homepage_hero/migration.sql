-- Banner hero trang chủ, SuperAdmin sửa chữ và ảnh.
ALTER TABLE "cms"."cms_homepage_settings"
  ADD COLUMN IF NOT EXISTS "hero" JSONB;
