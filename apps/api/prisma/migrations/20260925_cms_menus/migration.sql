-- CreateTable
CREATE TABLE IF NOT EXISTS "cms"."cms_menu" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "location" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cms"."cms_menu_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "menu_id" UUID NOT NULL,
    "parent_id" UUID,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "open_in_new_tab" BOOLEAN NOT NULL DEFAULT false,
    "object_type" TEXT NOT NULL DEFAULT 'custom',
    "object_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cms_menu_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_menu_tenant_id_location_key" ON "cms"."cms_menu"("tenant_id", "location");
CREATE INDEX IF NOT EXISTS "cms_menu_item_menu_id_sort_order_idx" ON "cms"."cms_menu_item"("menu_id", "sort_order");
CREATE INDEX IF NOT EXISTS "cms_menu_item_parent_id_idx" ON "cms"."cms_menu_item"("parent_id");

DO $$ BEGIN
  ALTER TABLE "cms"."cms_menu_item"
    ADD CONSTRAINT "cms_menu_item_menu_id_fkey"
    FOREIGN KEY ("menu_id") REFERENCES "cms"."cms_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cms"."cms_menu_item"
    ADD CONSTRAINT "cms_menu_item_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "cms"."cms_menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
