import type {
  SupportChatMessageView,
  SupportChatThreadView,
  SupportChatView,
} from '@industriallink/contracts';
import { apiRequest } from '@/lib/api';

export function fetchMySupportChat(markRead: boolean): Promise<SupportChatView> {
  return apiRequest<SupportChatView>(`/support-chat?mark=${markRead ? '1' : '0'}`);
}

export function sendSupportChat(body: string): Promise<SupportChatMessageView> {
  return apiRequest<SupportChatMessageView>('/support-chat', { method: 'POST', body: { body } });
}

export function fetchSupportThreads(): Promise<SupportChatThreadView[]> {
  return apiRequest<SupportChatThreadView[]>('/crm/support-chats');
}

export function fetchSupportThreadMessages(id: string): Promise<SupportChatMessageView[]> {
  return apiRequest<SupportChatMessageView[]>(`/crm/support-chats/${id}/messages`);
}

export function replySupportThread(id: string, body: string): Promise<SupportChatMessageView> {
  return apiRequest<SupportChatMessageView>(`/crm/support-chats/${id}/messages`, {
    method: 'POST',
    body: { body },
  });
}
