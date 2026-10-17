CREATE TABLE "crm"."crm_marketing_channel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_group" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_marketing_channel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_marketing_channel_code_key" ON "crm"."crm_marketing_channel"("code");

CREATE TABLE "crm"."crm_campaign" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "starts_on" DATE,
    "ends_on" DATE,
    "budget_vnd" BIGINT,
    "owner_user_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_campaign_campaign_code_key" ON "crm"."crm_campaign"("campaign_code");
CREATE INDEX "crm_campaign_owner_user_id_status_idx" ON "crm"."crm_campaign"("owner_user_id", "status");
CREATE INDEX "crm_campaign_channel_id_idx" ON "crm"."crm_campaign"("channel_id");

CREATE TABLE "crm"."crm_marketing_cost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "spent_on" DATE NOT NULL,
    "amount_vnd" BIGINT NOT NULL,
    "note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_marketing_cost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_marketing_cost_campaign_id_spent_on_idx" ON "crm"."crm_marketing_cost"("campaign_id", "spent_on");

ALTER TABLE "crm"."crm_lead" ADD COLUMN "campaign_id" UUID;

CREATE INDEX "crm_lead_campaign_id_idx" ON "crm"."crm_lead"("campaign_id");

ALTER TABLE "crm"."crm_campaign" ADD CONSTRAINT "crm_campaign_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "crm"."crm_marketing_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm"."crm_marketing_cost" ADD CONSTRAINT "crm_marketing_cost_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm"."crm_campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm"."crm_marketing_cost" ADD CONSTRAINT "crm_marketing_cost_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "crm"."crm_marketing_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm"."crm_lead" ADD CONSTRAINT "crm_lead_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm"."crm_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "crm"."crm_marketing_channel" ("code", "name", "channel_group", "sort_order") VALUES
    ('web', 'Web', 'owned', 10),
    ('zalo', 'Zalo', 'owned', 20),
    ('event', 'Sự kiện', 'owned', 30),
    ('partner', 'Cộng tác viên', 'owned', 40),
    ('facebook', 'Facebook', 'social', 50),
    ('instagram', 'Instagram', 'social', 60),
    ('tiktok', 'TikTok', 'social', 70),
    ('linkedin', 'LinkedIn', 'social', 80),
    ('x', 'X', 'social', 90),
    ('youtube', 'YouTube', 'social', 100)
ON CONFLICT ("code") DO NOTHING;
