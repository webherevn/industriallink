import type {
  IndexingSettingsView,
  IndexingSubmitRequest,
  IndexingSubmitResult,
  IndexingTestResult,
  UpdateIndexingSettingsRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchIndexingSettings(): Promise<IndexingSettingsView> {
  return apiRequest<IndexingSettingsView>('/admin/cms/indexing/settings');
}

export async function updateIndexingSettings(body: UpdateIndexingSettingsRequest): Promise<IndexingSettingsView> {
  return apiRequest<IndexingSettingsView>('/admin/cms/indexing/settings', { method: 'PUT', body });
}

export async function testIndexing(): Promise<IndexingTestResult> {
  return apiRequest<IndexingTestResult>('/admin/cms/indexing/test', { method: 'POST' });
}

export async function submitIndexing(body: IndexingSubmitRequest): Promise<IndexingSubmitResult> {
  return apiRequest<IndexingSubmitResult>('/admin/cms/indexing/submit', { method: 'POST', body });
}
