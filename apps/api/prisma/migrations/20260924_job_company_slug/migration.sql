-- SEO-friendly public URLs for jobs and companies.
ALTER TABLE "company"."company" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "recruitment"."job" ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "company_slug_key" ON "company"."company"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "job_slug_key" ON "recruitment"."job"("slug");
