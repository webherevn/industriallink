-- Yêu cầu kết nối NTD ↔ ứng viên + shortlist lưu CV
CREATE TABLE IF NOT EXISTS "candidate"."candidate_connection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_connection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_connection_company_id_candidate_id_key"
  ON "candidate"."candidate_connection"("company_id", "candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_connection_candidate_id_status_idx"
  ON "candidate"."candidate_connection"("candidate_id", "status");
CREATE INDEX IF NOT EXISTS "candidate_connection_company_id_status_idx"
  ON "candidate"."candidate_connection"("company_id", "status");
CREATE INDEX IF NOT EXISTS "candidate_connection_tenant_id_idx"
  ON "candidate"."candidate_connection"("tenant_id");

ALTER TABLE "candidate"."candidate_connection"
  ADD CONSTRAINT "candidate_connection_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate"."candidate_connection"
  ADD CONSTRAINT "candidate_connection_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidate"."candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate"."candidate_connection"
  ADD CONSTRAINT "candidate_connection_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "candidate"."candidate_shortlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "company_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "saved_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_shortlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_shortlist_company_id_candidate_id_key"
  ON "candidate"."candidate_shortlist"("company_id", "candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_shortlist_company_id_idx"
  ON "candidate"."candidate_shortlist"("company_id");
CREATE INDEX IF NOT EXISTS "candidate_shortlist_tenant_id_idx"
  ON "candidate"."candidate_shortlist"("tenant_id");

ALTER TABLE "candidate"."candidate_shortlist"
  ADD CONSTRAINT "candidate_shortlist_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"."company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate"."candidate_shortlist"
  ADD CONSTRAINT "candidate_shortlist_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidate"."candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate"."candidate_shortlist"
  ADD CONSTRAINT "candidate_shortlist_saved_by_user_id_fkey"
  FOREIGN KEY ("saved_by_user_id") REFERENCES "identity"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
