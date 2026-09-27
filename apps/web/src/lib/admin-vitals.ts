import type {
  CwvJob,
  CwvReport,
  CwvSettingsView,
  CwvStrategy,
  CwvTestResult,
  UpdateCwvSettingsRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchCwvReport(strategy: CwvStrategy): Promise<CwvReport> {
  return apiRequest<CwvReport>(`/admin/cms/vitals?strategy=${strategy}`);
}

export async function startCwvScan(body: { strategy: CwvStrategy; paths?: string[] }): Promise<CwvJob> {
  return apiRequest<CwvJob>('/admin/cms/vitals/scan', { method: 'POST', body });
}

export async function fetchCwvSettings(): Promise<CwvSettingsView> {
  return apiRequest<CwvSettingsView>('/admin/cms/vitals/settings');
}

export async function updateCwvSettings(body: UpdateCwvSettingsRequest): Promise<CwvSettingsView> {
  return apiRequest<CwvSettingsView>('/admin/cms/vitals/settings', { method: 'PUT', body });
}

export async function testCwvKey(): Promise<CwvTestResult> {
  return apiRequest<CwvTestResult>('/admin/cms/vitals/test', { method: 'POST' });
}
