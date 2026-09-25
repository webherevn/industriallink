-- CMS SEO fields + redirect manager (Blog/Pages phase).
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "author_name" TEXT;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "author_title" TEXT;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "author_bio" TEXT;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "og_title" TEXT;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "og_description" TEXT;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "robots_index" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "robots_follow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "robots_max_image_preview" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "cms"."cms_post" ADD COLUMN IF NOT EXISTS "faq_json" JSONB;

CREATE TABLE IF NOT EXISTS "cms"."cms_redirect" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cms_redirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_redirect_from_path_key" ON "cms"."cms_redirect"("from_path");
CREATE INDEX IF NOT EXISTS "cms_redirect_to_path_idx" ON "cms"."cms_redirect"("to_path");
