export interface CopilotChatRequest {
  message: string;
}

export interface CopilotSource {
  title: string;
  snippet: string;
}

export interface CopilotChatResponse {
  answer: string;
  sources: CopilotSource[];
  /** Provider AI đã trả lời (mock/openai/…). */
  provider: string;
}
