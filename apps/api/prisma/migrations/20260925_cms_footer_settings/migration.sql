-- Footer settings (Footer 1 / Footer 2 + copyright)
CREATE TABLE IF NOT EXISTS "cms"."cms_footer_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "footer1_enabled" BOOLEAN NOT NULL DEFAULT true,
    "footer1_columns" JSONB NOT NULL DEFAULT '[]',
    "footer2_enabled" BOOLEAN NOT NULL DEFAULT true,
    "footer2_columns" JSONB NOT NULL DEFAULT '[]',
    "copyright_text" TEXT NOT NULL DEFAULT '©2026 Inlink Vietnam JSC. All rights reserved.',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_footer_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_footer_settings_tenant_id_key"
  ON "cms"."cms_footer_settings"("tenant_id");
