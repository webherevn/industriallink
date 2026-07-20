import { apiRequest } from './api';
import type { CandidateSearchFilters, CandidateSearchResult } from '@industriallink/contracts';

export type { CandidateSearchFilters, CandidateSearchResult };

export async function searchCandidates(
  query: string | CandidateSearchFilters,
): Promise<CandidateSearchResult[]> {
  const filters: CandidateSearchFilters =
    typeof query === 'string' ? { q: query } : query;

  const qs = new URLSearchParams();
  if (filters.q?.trim()) qs.set('q', filters.q.trim());
  const csv = (key: string, values?: string[]) => {
    if (values?.length) qs.set(key, values.join(','));
  };
  csv('industries', filters.industries);
  csv('products', filters.products);
  csv('customerSegments', filters.customerSegments);
  if (filters.b2bExperience) qs.set('b2bExperience', filters.b2bExperience);
  csv('regions', filters.regions);
  if (filters.customerDevStyle) qs.set('customerDevStyle', filters.customerDevStyle);
  if (filters.dealType) qs.set('dealType', filters.dealType);
  csv('jobReadiness', filters.jobReadiness);
  csv('languages', filters.languages);
  if (filters.requireB2License) qs.set('requireB2License', '1');
  if (filters.requireTravel) qs.set('requireTravel', '1');
  if (filters.expectedSalaryMin != null) {
    qs.set('expectedSalaryMin', String(filters.expectedSalaryMin));
  }
  if (filters.expectedSalaryMax != null) {
    qs.set('expectedSalaryMax', String(filters.expectedSalaryMax));
  }

  const suffix = qs.toString();
  return apiRequest(`/search/candidates${suffix ? `?${suffix}` : ''}`);
}
