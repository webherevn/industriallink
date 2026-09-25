-- Public author archive + SEO / E-E-A-T fields
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "works_for" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "seo_title" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "seo_description" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "focus_keyword" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "canonical_path" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "og_title" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "og_description" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "og_image_url" TEXT;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "robots_index" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "robots_follow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_author_profile" ADD COLUMN IF NOT EXISTS "robots_max_image_preview" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "cms_author_profile_slug_key"
  ON "cms"."cms_author_profile"("slug");

CREATE INDEX IF NOT EXISTS "cms_author_profile_is_public_slug_idx"
  ON "cms"."cms_author_profile"("is_public", "slug");
