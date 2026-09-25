import {
  buildJobBreadcrumbJsonLd,
  buildJobPostingJsonLd,
  isJobExpiredForSeo,
  jobPublicPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '@/lib/seo-robots';
import { fetchPublicJob, fetchPublishedJobs } from '@/lib/public-job-api';
import { apiPublicBase, siteUrl } from '@/lib/public-paths';
import { JobDetailClient } from '../job-detail-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await fetchPublicJob(slug);
  if (!job) return { robots: NOINDEX_ROBOTS };
  const expired = isJobExpiredForSeo(job);
  return {
    title: `${job.title} tại ${job.companyName} | inlink`,
    description: job.description.replace(/<[^>]+>/g, ' ').slice(0, 160),
    robots: expired ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    alternates: { canonical: jobPublicPath(job) },
  };
}

/** Tin công khai: /viec-lam/{slug} */
export default async function PublicJobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await fetchPublicJob(slug);
  if (!job) notFound();

  const expired = isJobExpiredForSeo(job);
  const origin = siteUrl();
  const logoUrl = job.companyHasLogo
    ? `${apiPublicBase()}/companies/${job.companyId}/logo`
    : undefined;
  const schemas = expired
    ? [buildJobBreadcrumbJsonLd(job, origin)]
    : [buildJobPostingJsonLd(job, { siteUrl: origin, logoUrl }), buildJobBreadcrumbJsonLd(job, origin)];

  const similar = expired
    ? (await fetchPublishedJobs({ industry: job.industry ?? undefined }))
        .filter((j) => j.slug !== job.slug)
        .slice(0, 6)
    : [];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {expired ? (
        <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-amber-800">
          Tin này đã hết hạn hoặc ngừng tuyển. Xem các việc làm tương tự trong cùng ngành.
        </div>
      ) : null}
      <JobDetailClient initialJob={job} jobRef={slug} />
      {expired && similar.length > 0 ? (
        <p className="sr-only">
          Việc làm tương tự: {similar.map((j) => j.title).join(', ')}
        </p>
      ) : null}
    </>
  );
}
