import type { AdminReportsView } from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

export async function fetchAdminReports(): Promise<AdminReportsView> {
  const data = await apiRequest<AdminReportsView>('/admin/reports');
  return {
    ...data,
    jobs: {
      ...data?.jobs,
      byDay: asArray(data?.jobs?.byDay),
    },
  };
}
