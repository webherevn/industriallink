-- robots.txt + Insert Header/Footer (site code)
CREATE TABLE IF NOT EXISTS "cms"."cms_robots_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_robots_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_robots_settings_tenant_id_key"
  ON "cms"."cms_robots_settings"("tenant_id");

CREATE TABLE IF NOT EXISTS "cms"."cms_site_code_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "header_enabled" BOOLEAN NOT NULL DEFAULT true,
    "header_code" TEXT NOT NULL DEFAULT '',
    "footer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "footer_code" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_site_code_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_site_code_settings_tenant_id_key"
  ON "cms"."cms_site_code_settings"("tenant_id");
