export interface CopilotChatRequest {
  message: string;
}

export interface CopilotSource {
  title: string;
  snippet: string;
  /** Id ứng viên (khi source là gợi ý hồ sơ) — dùng deep-link xem hồ sơ. */
  candidateIds?: string[];
}

export interface CopilotChatResponse {
  answer: string;
  sources: CopilotSource[];
  /** Provider AI đã trả lời (mock/openai/…). */
  provider: string;
}
