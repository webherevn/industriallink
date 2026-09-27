-- Thư mục này xếp trước 20260927_analytics_hit, nên phải tự tạo bảng nếu chưa có.
CREATE TABLE IF NOT EXISTS "shared"."analytics_hit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visitor_id" VARCHAR(64) NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "title" VARCHAR(300),
    "referrer" VARCHAR(500),
    "source" VARCHAR(200) NOT NULL DEFAULT 'Trực tiếp',
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(400),
    "device" VARCHAR(16) NOT NULL DEFAULT 'desktop',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_hit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "shared"."analytics_hit"
  ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "analytics_hit_created_at_idx"
  ON "shared"."analytics_hit"("created_at");
CREATE INDEX IF NOT EXISTS "analytics_hit_session_id_created_at_idx"
  ON "shared"."analytics_hit"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_hit_visitor_id_created_at_idx"
  ON "shared"."analytics_hit"("visitor_id", "created_at");
