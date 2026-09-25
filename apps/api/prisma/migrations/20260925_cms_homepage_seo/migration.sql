-- Homepage SEO / hero settings
CREATE TABLE IF NOT EXISTS "cms"."cms_homepage_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "heading" TEXT NOT NULL DEFAULT 'Tìm đúng cơ hội trong ngành công nghiệp',
    "heading_accent" TEXT,
    "subtitle" TEXT DEFAULT 'Hàng nghìn cơ hội việc làm từ các doanh nghiệp uy tín trong lĩnh vực kỹ thuật, sản xuất, vận hành và kinh doanh B2B.',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "focus_keyword" TEXT,
    "canonical_path" TEXT DEFAULT '/',
    "og_title" TEXT,
    "og_description" TEXT,
    "og_image_url" TEXT,
    "robots_index" BOOLEAN NOT NULL DEFAULT true,
    "robots_follow" BOOLEAN NOT NULL DEFAULT true,
    "robots_max_image_preview" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_homepage_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_homepage_settings_tenant_id_key"
  ON "cms"."cms_homepage_settings"("tenant_id");
