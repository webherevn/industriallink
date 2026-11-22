-- CreateTable
CREATE TABLE IF NOT EXISTS "crm"."recruiter_activity_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_activity_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recruiter_activity_event_company_id_created_at_idx" ON "crm"."recruiter_activity_event"("company_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "recruiter_activity_event_company_id_event_type_created_at_idx" ON "crm"."recruiter_activity_event"("company_id", "event_type", "created_at");
