import type {
  AiSettingsView,
  TestAiConnectionRequest,
  TestAiConnectionResponse,
  UpdateAiSettingsRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

/** Cấu hình AI hiện tại (key đã che). */
export async function fetchAiSettings(): Promise<AiSettingsView> {
  return apiRequest<AiSettingsView>('/admin/ai-settings');
}

/** Cập nhật cấu hình AI — áp dụng ngay (server tự reload gateway). */
export async function updateAiSettings(
  body: UpdateAiSettingsRequest,
): Promise<AiSettingsView> {
  return apiRequest<AiSettingsView>('/admin/ai-settings', { method: 'PUT', body });
}

/** Test kết nối tới provider. */
export async function testAiConnection(
  body: TestAiConnectionRequest = {},
): Promise<TestAiConnectionResponse> {
  return apiRequest<TestAiConnectionResponse>('/admin/ai-settings/test', {
    method: 'POST',
    body,
  });
}
