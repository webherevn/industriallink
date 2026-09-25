import type {
  CompanyPublicProfileView,
  JobListItem,
  JobView,
  ListPublishedJobsQuery,
} from '@industriallink/contracts';
import { apiPublicBase } from './public-paths';

export async function fetchPublishedJobs(
  params: ListPublishedJobsQuery = {},
): Promise<JobListItem[]> {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set('keyword', params.keyword);
  if (params.industry) qs.set('industry', params.industry);
  if (params.subIndustry) qs.set('subIndustry', params.subIndustry);
  if (params.location) qs.set('location', params.location);
  if (params.experienceBand) qs.set('experienceBand', params.experienceBand);
  if (params.jobLevel) qs.set('jobLevel', params.jobLevel);
  if (params.jobTrack) qs.set('jobTrack', params.jobTrack);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${apiPublicBase()}/jobs${suffix}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as JobListItem[];
}

export async function fetchPublicJob(ref: string): Promise<JobView | null> {
  const res = await fetch(`${apiPublicBase()}/jobs/${encodeURIComponent(ref)}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as JobView;
}

export async function fetchPublicCompany(ref: string): Promise<CompanyPublicProfileView | null> {
  const res = await fetch(`${apiPublicBase()}/companies/${encodeURIComponent(ref)}/profile`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as CompanyPublicProfileView;
}
