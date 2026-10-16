CREATE TABLE "crm"."crm_quote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_code" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "tax_code" TEXT,
    "contact_name" TEXT NOT NULL,
    "lead_id" UUID,
    "company_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "option1_kind" TEXT NOT NULL,
    "option1_code" TEXT NOT NULL,
    "option1_name" TEXT NOT NULL,
    "option1_price_vnd" BIGINT NOT NULL,
    "option2_kind" TEXT,
    "option2_code" TEXT,
    "option2_name" TEXT,
    "option2_price_vnd" BIGINT,
    "vat_percent" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_quote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_quote_quote_code_key" ON "crm"."crm_quote"("quote_code");

CREATE INDEX "crm_quote_owner_user_id_created_at_idx" ON "crm"."crm_quote"("owner_user_id", "created_at");
