-- Hồ sơ tác giả CMS (WP-style author profile)
CREATE TABLE IF NOT EXISTS "cms"."cms_author_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "website_url" TEXT,
    "facebook_url" TEXT,
    "linkedin_url" TEXT,
    "twitter_url" TEXT,
    "youtube_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    CONSTRAINT "cms_author_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_author_profile_user_id_key"
  ON "cms"."cms_author_profile"("user_id");
