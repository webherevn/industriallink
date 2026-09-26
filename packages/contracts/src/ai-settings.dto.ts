import type { AiProviderKind } from './enums';

/** Nguồn giá trị đang có hiệu lực. */
export type AiSettingsSource = 'db' | 'env';

/** Thông tin 1 provider hiển thị cho SuperAdmin (key luôn được che). */
export interface AiProviderView {
  /** Đã cấu hình API key hay chưa (không bao giờ trả key thật). */
  hasKey: boolean;
  /** 4 ký tự cuối của key để nhận diện, vd. "…a1b2". */
  keyPreview: string | null;
  /** Key đang lấy từ DB (đã lưu qua UI) hay từ biến môi trường. */
  keySource: AiSettingsSource | null;
}

/** Cấu hình AI hiện tại (đã che key) trả về cho trang /admin/ai-settings. */
export interface AiSettingsView {
  /** Provider được chọn trong cấu hình (mong muốn). */
  provider: AiProviderKind;
  /** Provider đang THỰC SỰ chạy (có thể là mock nếu thiếu key). */
  activeProvider: AiProviderKind;
  /** true nếu đang phải lùi về mock do thiếu key của provider đã chọn. */
  usingMockFallback: boolean;
  embeddingDim: number;

  openai: AiProviderView & { model: string; embeddingModel: string };
  anthropic: AiProviderView & { model: string };
  gemini: AiProviderView & { model: string; embeddingModel: string };

  /** Provider/model đang lấy từ DB hay env. */
  configSource: AiSettingsSource;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

/**
 * Cập nhật cấu hình. Trường bỏ trống/undefined = giữ nguyên.
 * Các trường *ApiKey: gửi chuỗi mới để đặt lại; gửi null để xoá (lùi về env).
 */
export interface UpdateAiSettingsRequest {
  provider?: AiProviderKind;
  embeddingDim?: number;

  openaiApiKey?: string | null;
  openaiModel?: string;
  openaiEmbeddingModel?: string;

  anthropicApiKey?: string | null;
  anthropicModel?: string;

  geminiApiKey?: string | null;
  geminiModel?: string;
  geminiEmbeddingModel?: string;
}

/** Yêu cầu test kết nối. Không truyền provider = test cấu hình đang lưu. */
export interface TestAiConnectionRequest {
  provider?: AiProviderKind;
}

export interface TestAiConnectionResponse {
  ok: boolean;
  provider: AiProviderKind;
  model: string;
  latencyMs: number;
  /** Thông điệp ngắn: thành công hoặc mô tả lỗi. */
  message: string;
}
