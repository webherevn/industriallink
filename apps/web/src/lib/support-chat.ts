import type {
  SupportChatMessageView,
  SupportChatPromptView,
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

export function fetchSupportPrompts(): Promise<SupportChatPromptView[]> {
  return apiRequest<SupportChatPromptView[]>('/support-chat/prompts');
}

export function fetchCrmSupportPrompts(): Promise<SupportChatPromptView[]> {
  return apiRequest<SupportChatPromptView[]>('/crm/support-chats/prompts');
}

export function addCrmSupportPrompt(body: string): Promise<SupportChatPromptView[]> {
  return apiRequest<SupportChatPromptView[]>('/crm/support-chats/prompts', { method: 'POST', body: { body } });
}

export function updateCrmSupportPrompt(id: string, body: string): Promise<SupportChatPromptView[]> {
  return apiRequest<SupportChatPromptView[]>(`/crm/support-chats/prompts/${id}`, {
    method: 'PATCH',
    body: { body },
  });
}

export function deleteCrmSupportPrompt(id: string): Promise<SupportChatPromptView[]> {
  return apiRequest<SupportChatPromptView[]>(`/crm/support-chats/prompts/${id}`, { method: 'DELETE' });
}

export function replySupportThread(id: string, body: string): Promise<SupportChatMessageView> {
  return apiRequest<SupportChatMessageView>(`/crm/support-chats/${id}/messages`, {
    method: 'POST',
    body: { body },
  });
}
