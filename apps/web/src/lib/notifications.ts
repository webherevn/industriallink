import type { NotificationListResponse, NotificationView } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listNotifications(): Promise<NotificationListResponse> {
  return apiRequest('/notifications');
}

export async function markNotificationRead(id: string): Promise<NotificationView> {
  return apiRequest(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiRequest('/notifications/read-all', { method: 'POST' });
}
