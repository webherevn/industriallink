import {
  companyPublicPath as publicCompanyPath,
  jobIndustryPath as industryPath,
  jobListingPath as listingPath,
  jobPublicPath as publicJobPath,
} from '@industriallink/contracts';
import { BRAND_SITE_URL } from './brand';

export const jobListingPath = listingPath;
export const jobIndustryPath = industryPath;
export const jobPublicPath = publicJobPath;
export const companyPublicPath = publicCompanyPath;

/** Mọi liên kết ra ngoài domain đều nofollow. */
export const EXTERNAL_REL = 'nofollow noopener noreferrer';

/** Chuẩn hoá URL ngoài: thêm https:// nếu thiếu scheme. */
export function externalHref(url?: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `https://${raw}`;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || BRAND_SITE_URL).replace(/\/$/, '');
}

export function apiPublicBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return `${fromEnv}/api/v1`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/v1`;
  return 'http://localhost:3001/api/v1';
}
