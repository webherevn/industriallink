import {
  cmsPagePublicPath,
  cmsPostPublicPath,
  companyPublicPath,
  jobListingPath,
  jobPublicPath,
  CmsContentType,
} from '@industriallink/contracts';
import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/brand';
import { fetchPublishedCmsPosts } from '@/lib/public-cms-api';
import { fetchPublishedJobs } from '@/lib/public-job-api';

/** Sitemap index chia nhỏ: main, jobs, blog, pages. */
export async function generateSitemaps() {
  return [{ id: 'main' }, { id: 'jobs' }, { id: 'blog' }, { id: 'pages' }];
}

export default async function sitemap(props: {
  id: Promise<string> | string;
}): Promise<MetadataRoute.Sitemap> {
  const id = typeof props.id === 'string' ? props.id : await props.id;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || BRAND_SITE_URL;

  if (id === 'blog') {
    const posts = await fetchPublishedCmsPosts({ type: CmsContentType.Post, limit: 500 });
    return [
      { url: `${base}/cam-nang`, changeFrequency: 'weekly', priority: 0.7 },
      ...posts.map((post) => ({
        url: `${base}${cmsPostPublicPath(post.slug)}`,
        lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(post.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.65,
      })),
    ];
  }

  if (id === 'pages') {
    const pages = await fetchPublishedCmsPosts({ type: CmsContentType.Page, limit: 200 });
    return pages.map((page) => ({
      url: `${base}${cmsPagePublicPath(page.slug)}`,
      lastModified: page.publishedAt ? new Date(page.publishedAt) : new Date(page.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }));
  }

  if (id === 'jobs') {
    const jobs = await fetchPublishedJobs();
    return jobs.map((job) => ({
      url: `${base}${jobPublicPath(job)}`,
      lastModified: job.publishedAt ? new Date(job.publishedAt) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  }

  // main
  const jobs = await fetchPublishedJobs();
  const companies = new Map<string, string>();
  for (const job of jobs) {
    const path = companyPublicPath(job);
    if (!companies.has(path)) companies.set(path, job.publishedAt ?? job.createdAt);
  }
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}${jobListingPath()}`, changeFrequency: 'hourly', priority: 0.9 },
    ...[...companies.entries()].map(([path, last]) => ({
      url: `${base}${path}`,
      lastModified: last ? new Date(last) : undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
