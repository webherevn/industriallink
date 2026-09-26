import type { AdminReportsView } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchAdminReports(): Promise<AdminReportsView> {
  return apiRequest<AdminReportsView>('/admin/reports');
}
