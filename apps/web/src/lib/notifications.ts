import type { NotificationListResponse, NotificationView } from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

export async function listNotifications(): Promise<NotificationListResponse> {
  const data = await apiRequest<NotificationListResponse>('/notifications');
  return {
    ...data,
    items: asArray(data?.items),
    unreadCount: typeof data?.unreadCount === 'number' ? data.unreadCount : 0,
  };
}

export async function markNotificationRead(id: string): Promise<NotificationView> {
  return apiRequest(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiRequest('/notifications/read-all', { method: 'POST' });
}
