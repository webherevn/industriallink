import {
  cmsPagePublicPath,
  cmsPostPublicPath,
  companyPublicPath,
  jobListingPath,
  jobPublicPath,
} from '@industriallink/contracts';
import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/brand';
import { fetchPublishedCmsPosts } from '@/lib/public-cms-api';
import { fetchPublishedJobs } from '@/lib/public-job-api';
import { CmsContentType } from '@industriallink/contracts';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || BRAND_SITE_URL;
  const [jobs, posts, pages] = await Promise.all([
    fetchPublishedJobs(),
    fetchPublishedCmsPosts({ type: CmsContentType.Post, limit: 200 }),
    fetchPublishedCmsPosts({ type: CmsContentType.Page, limit: 100 }),
  ]);
  const companies = new Map<string, string>();
  for (const job of jobs) {
    const path = companyPublicPath(job);
    if (!companies.has(path)) companies.set(path, job.publishedAt ?? job.createdAt);
  }

  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}${jobListingPath()}`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/cam-nang`, changeFrequency: 'weekly', priority: 0.7 },
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
    ...posts.map((post) => ({
      url: `${base}${cmsPostPublicPath(post.slug)}`,
      lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.65,
    })),
    ...pages.map((page) => ({
      url: `${base}${cmsPagePublicPath(page.slug)}`,
      lastModified: page.publishedAt ? new Date(page.publishedAt) : new Date(page.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
