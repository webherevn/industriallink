import type { CopilotChatRequest, CopilotChatResponse } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function askCopilot(input: CopilotChatRequest): Promise<CopilotChatResponse> {
  return apiRequest('/ai/copilot/chat', { method: 'POST', body: input });
}
