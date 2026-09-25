import { toSeoSlug } from './seo-slug';

export const JOB_LISTING_PATH = '/viec-lam';
export const FALLBACK_INDUSTRY_SEGMENT = 'khac';

export function industryPathSegment(industry?: string | null): string {
  const slug = industry?.trim() ? toSeoSlug(industry) : '';
  return slug || FALLBACK_INDUSTRY_SEGMENT;
}

export function jobListingPath(): string {
  return JOB_LISTING_PATH;
}

export function jobIndustryPath(industry?: string | null): string {
  return `${JOB_LISTING_PATH}/${industryPathSegment(industry)}`;
}

export function jobPublicPath(job: {
  slug?: string | null;
  id?: string;
  jobId?: string;
  industry?: string | null;
}): string {
  const slug = job.slug || job.id || job.jobId || '';
  return `${JOB_LISTING_PATH}/${slug}`;
}

export const COMPANY_PUBLIC_PREFIX = '/cong-ty';

export function companyPublicPath(company: {
  slug?: string | null;
  companySlug?: string | null;
  id?: string;
  companyId?: string;
}): string {
  const slug = company.companySlug ?? (company.companyId ? null : company.slug);
  const id = company.companyId ?? company.id ?? '';
  return `${COMPANY_PUBLIC_PREFIX}/${slug || id}`;
}
