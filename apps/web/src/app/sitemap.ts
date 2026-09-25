import { companyPublicPath, jobListingPath, jobPublicPath } from '@industriallink/contracts';
import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/brand';
import { fetchPublishedJobs } from '@/lib/public-job-api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || BRAND_SITE_URL;
  const jobs = await fetchPublishedJobs();
  const companies = new Map<string, string>();
  for (const job of jobs) {
    const path = companyPublicPath(job);
    if (!companies.has(path)) companies.set(path, job.publishedAt ?? job.createdAt);
  }

  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}${jobListingPath()}`, changeFrequency: 'hourly', priority: 0.9 },
    ...jobs.map((job) => ({
      url: `${base}${jobPublicPath(job)}`,
      lastModified: job.publishedAt ? new Date(job.publishedAt) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...[...companies.entries()].map(([path, last]) => ({
      url: `${base}${path}`,
      lastModified: last ? new Date(last) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
