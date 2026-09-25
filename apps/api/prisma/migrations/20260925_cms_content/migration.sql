-- CMS schema: categories + posts/pages with embedded SEO fields.
CREATE SCHEMA IF NOT EXISTS cms;

CREATE TABLE IF NOT EXISTS "cms"."cms_category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "og_image_url" TEXT,
    "robots" TEXT NOT NULL DEFAULT 'index,follow',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cms_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_category_slug_key" ON "cms"."cms_category"("slug");
CREATE INDEX IF NOT EXISTS "cms_category_tenant_id_is_deleted_idx" ON "cms"."cms_category"("tenant_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "cms_category_sort_order_idx" ON "cms"."cms_category"("sort_order");

CREATE TABLE IF NOT EXISTS "cms"."cms_post" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body_html" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category_id" UUID,
    "published_at" TIMESTAMP(3),
    "author_id" UUID NOT NULL,
    "cover_image_url" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "canonical_path" TEXT,
    "og_image_url" TEXT,
    "robots" TEXT NOT NULL DEFAULT 'index,follow',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "cms_post_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_post_type_slug_key" ON "cms"."cms_post"("type", "slug");
CREATE INDEX IF NOT EXISTS "cms_post_tenant_type_status_published_idx" ON "cms"."cms_post"("tenant_id", "type", "status", "published_at");
CREATE INDEX IF NOT EXISTS "cms_post_category_id_idx" ON "cms"."cms_post"("category_id");
CREATE INDEX IF NOT EXISTS "cms_post_author_id_idx" ON "cms"."cms_post"("author_id");
CREATE INDEX IF NOT EXISTS "cms_post_is_deleted_idx" ON "cms"."cms_post"("is_deleted");

DO $$ BEGIN
  ALTER TABLE "cms"."cms_post"
    ADD CONSTRAINT "cms_post_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "cms"."cms_category"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
