import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProviderKind,
  type AiSettingsSource,
  type AiSettingsView,
  type CwvSettingsView,
  type TestAiConnectionResponse,
  type UpdateAiSettingsRequest,
  type UpdateCwvSettingsRequest,
} from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { decryptSecret, encryptSecret, keyPreview } from './ai-settings.cipher';
import { buildAiProvider, type ResolvedAiConfig } from './providers/ai-provider.factory';
import { GeminiProvider } from './providers/gemini.provider';
import type { JobModerationInput } from './providers/job-moderation.util';

const SCOPE = 'default';

type AiSettingRow = Prisma.AiSettingGetPayload<Record<string, never>>;

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Khoá mã hoá: ưu tiên SETTINGS_ENCRYPTION_KEY, fallback JWT access secret. */
  private encryptionSecret(): string {
    const ai = this.config.get('ai', { infer: true });
    if (ai.settingsEncryptionKey) return ai.settingsEncryptionKey;
    return this.config.get('jwt', { infer: true }).accessSecret;
  }

  private async row(): Promise<AiSettingRow | null> {
    try {
      return await this.prisma.aiSetting.findUnique({ where: { scope: SCOPE } });
    } catch (err) {
      // Bảng chưa migrate hoặc DB lỗi → coi như chưa cấu hình, dùng env.
      this.logger.warn(`Không đọc được ai_setting, dùng env: ${String(err)}`);
      return null;
    }
  }

  private decrypt(enc: string | null | undefined): string | undefined {
    if (!enc) return undefined;
    try {
      return decryptSecret(enc, this.encryptionSecret());
    } catch (err) {
      this.logger.error(`Giải mã API key thất bại (khoá mã hoá đổi?): ${String(err)}`);
      return undefined;
    }
  }

  /**
   * Cấu hình có hiệu lực = DB (nếu có) đè lên env. Key được giải mã.
   * AiGatewayService.reload() gọi hàm này để dựng provider.
   */
  async resolveConfig(): Promise<ResolvedAiConfig> {
    const env = this.config.get('ai', { infer: true });
    const row = await this.row();
    if (!row) return env;

    const dbKey = {
      openai: this.decrypt(row.openaiApiKeyEnc),
      anthropic: this.decrypt(row.anthropicApiKeyEnc),
      gemini: this.decrypt(row.geminiApiKeyEnc),
    };

    return {
      ...env,
      provider: (row.provider as ResolvedAiConfig['provider']) ?? env.provider,
      embeddingDim: row.embeddingDim ?? env.embeddingDim,
      openaiApiKey: dbKey.openai ?? env.openaiApiKey,
      openaiModel: row.openaiModel ?? env.openaiModel,
      openaiEmbeddingModel: row.openaiEmbeddingModel ?? env.openaiEmbeddingModel,
      anthropicApiKey: dbKey.anthropic ?? env.anthropicApiKey,
      anthropicModel: row.anthropicModel ?? env.anthropicModel,
      geminiApiKey: dbKey.gemini ?? env.geminiApiKey,
      geminiModel: row.geminiModel ?? env.geminiModel,
      geminiEmbeddingModel: row.geminiEmbeddingModel ?? env.geminiEmbeddingModel,
    };
  }

  /** Cấu hình đã che key — cho trang /admin/ai-settings. */
  async getView(): Promise<AiSettingsView> {
    const env = this.config.get('ai', { infer: true });
    const row = await this.row();
    const resolved = await this.resolveConfig();
    const built = buildAiProvider(resolved);

    const keySource = (
      enc: string | null | undefined,
      envKey: string | undefined,
    ): AiSettingsSource | null => (enc ? 'db' : envKey ? 'env' : null);

    const updatedByEmail = row?.updatedBy
      ? (
          await this.prisma.user.findUnique({
            where: { id: row.updatedBy },
            select: { email: true },
          })
        )?.email ?? null
      : null;

    return {
      provider: resolved.provider as AiProviderKind,
      activeProvider: built.provider.name as AiProviderKind,
      usingMockFallback: built.fellBackToMock,
      embeddingDim: resolved.embeddingDim,
      openai: {
        model: resolved.openaiModel,
        embeddingModel: resolved.openaiEmbeddingModel,
        hasKey: Boolean(resolved.openaiApiKey),
        keyPreview: keyPreview(resolved.openaiApiKey),
        keySource: keySource(row?.openaiApiKeyEnc, env.openaiApiKey),
      },
      anthropic: {
        model: resolved.anthropicModel,
        hasKey: Boolean(resolved.anthropicApiKey),
        keyPreview: keyPreview(resolved.anthropicApiKey),
        keySource: keySource(row?.anthropicApiKeyEnc, env.anthropicApiKey),
      },
      gemini: {
        model: resolved.geminiModel,
        embeddingModel: resolved.geminiEmbeddingModel,
        hasKey: Boolean(resolved.geminiApiKey),
        keyPreview: keyPreview(resolved.geminiApiKey),
        keySource: keySource(row?.geminiApiKeyEnc, env.geminiApiKey),
      },
      seoGemini: this.seoGeminiView(row),
      configSource: row?.provider ? 'db' : 'env',
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      updatedByEmail,
    };
  }

  /**
   * Cập nhật cấu hình. Trả về view mới.
   * Quy ước key: string rỗng/undefined = giữ nguyên; null = xoá (lùi về env).
   */
  async update(dto: UpdateAiSettingsRequest, adminId: string): Promise<AiSettingsView> {
    const secret = this.encryptionSecret();

    const keyUpdate = (
      value: string | null | undefined,
    ): string | null | undefined => {
      if (value === null) return null; // xoá
      if (typeof value === 'string' && value.trim() !== '') {
        return encryptSecret(value.trim(), secret);
      }
      return undefined; // giữ nguyên
    };

    const data: Prisma.AiSettingUncheckedUpdateInput = {
      updatedBy: adminId,
    };
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.embeddingDim !== undefined) data.embeddingDim = dto.embeddingDim;
    if (dto.openaiModel !== undefined) data.openaiModel = dto.openaiModel;
    if (dto.openaiEmbeddingModel !== undefined) data.openaiEmbeddingModel = dto.openaiEmbeddingModel;
    if (dto.anthropicModel !== undefined) data.anthropicModel = dto.anthropicModel;
    if (dto.geminiModel !== undefined) data.geminiModel = dto.geminiModel;
    if (dto.geminiEmbeddingModel !== undefined) data.geminiEmbeddingModel = dto.geminiEmbeddingModel;
    if (dto.seoGeminiModel !== undefined) data.seoGeminiModel = dto.seoGeminiModel.trim() || null;

    const openaiEnc = keyUpdate(dto.openaiApiKey);
    if (openaiEnc !== undefined) data.openaiApiKeyEnc = openaiEnc;
    const anthropicEnc = keyUpdate(dto.anthropicApiKey);
    if (anthropicEnc !== undefined) data.anthropicApiKeyEnc = anthropicEnc;
    const geminiEnc = keyUpdate(dto.geminiApiKey);
    if (geminiEnc !== undefined) data.geminiApiKeyEnc = geminiEnc;
    const seoGeminiEnc = keyUpdate(dto.seoGeminiApiKey);
    if (seoGeminiEnc !== undefined) data.seoGeminiApiKeyEnc = seoGeminiEnc;

    await this.prisma.aiSetting.upsert({
      where: { scope: SCOPE },
      create: {
        scope: SCOPE,
        ...(data as Prisma.AiSettingUncheckedCreateInput),
      },
      update: data,
    });

    return this.getView();
  }

  /**
   * Khóa Gemini chỉ dùng khi quét bài đang viết. Không lấy khóa JD/CV.
   * null nếu chưa lưu.
   */
  async resolveSeoGemini(): Promise<{ apiKey: string; model: string } | null> {
    const row = await this.row();
    const apiKey = this.decrypt(row?.seoGeminiApiKeyEnc);
    if (!apiKey) return null;
    return { apiKey, model: row?.seoGeminiModel?.trim() || 'gemini-2.5-flash' };
  }

  /** Test đúng khóa SEO, không gọi moderateJobPosting của khóa JD/CV. */
  async testSeoGemini(): Promise<TestAiConnectionResponse> {
    const seo = await this.resolveSeoGemini();
    if (!seo) {
      return {
        ok: false,
        provider: AiProviderKind.Gemini,
        model: 'gemini-2.5-flash',
        latencyMs: 0,
        message: 'Chưa lưu khóa Gemini SEO. Khóa Google Gemini phía trên không được dùng cho mục này.',
      };
    }
    const started = Date.now();
    try {
      const text = await this.seoClient(seo).chat({
        system: 'Trả lời đúng một từ: OK',
        user: 'Kiểm tra kết nối.',
      });
      return {
        ok: Boolean(text.trim()),
        provider: AiProviderKind.Gemini,
        model: seo.model,
        latencyMs: Date.now() - started,
        message: text.trim()
          ? 'Khóa Gemini SEO kết nối được. Khóa này không dùng cho JD hay CV.'
          : 'Gemini SEO trả về rỗng.',
      };
    } catch (err) {
      return {
        ok: false,
        provider: AiProviderKind.Gemini,
        model: seo.model,
        latencyMs: Date.now() - started,
        message: this.shortError(err),
      };
    }
  }

  /** Domain công khai mặc định cho PageSpeed; localhost không dùng được. */
  defaultPagespeedSite(): string | null {
    const raw = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || '').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(raw)) return null;
    try {
      const host = new URL(raw).hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return null;
    } catch {
      return null;
    }
    return raw;
  }

  async resolvePagespeed(): Promise<{ apiKey: string | null; siteUrl: string | null; autoScan: boolean }> {
    const row = await this.row();
    return {
      apiKey: this.decrypt(row?.pagespeedApiKeyEnc) ?? null,
      siteUrl: row?.pagespeedSiteUrl?.trim() || this.defaultPagespeedSite(),
      autoScan: row?.pagespeedAutoScan ?? true,
    };
  }

  async pagespeedView(): Promise<CwvSettingsView> {
    const row = await this.row();
    const apiKey = this.decrypt(row?.pagespeedApiKeyEnc);
    return {
      hasKey: Boolean(apiKey),
      keyPreview: keyPreview(apiKey),
      siteUrl: row?.pagespeedSiteUrl?.trim() || null,
      defaultSiteUrl: this.defaultPagespeedSite(),
      autoScan: row?.pagespeedAutoScan ?? true,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }

  async updatePagespeed(dto: UpdateCwvSettingsRequest, adminId: string): Promise<CwvSettingsView> {
    const data: Prisma.AiSettingUncheckedUpdateInput = { updatedBy: adminId };
    if (dto.apiKey === null) data.pagespeedApiKeyEnc = null;
    else if (typeof dto.apiKey === 'string' && dto.apiKey.trim()) {
      data.pagespeedApiKeyEnc = encryptSecret(dto.apiKey.trim(), this.encryptionSecret());
    }
    if (dto.siteUrl !== undefined) data.pagespeedSiteUrl = dto.siteUrl?.trim().replace(/\/$/, '') || null;
    if (dto.autoScan !== undefined) data.pagespeedAutoScan = dto.autoScan;
    await this.prisma.aiSetting.upsert({
      where: { scope: SCOPE },
      create: { scope: SCOPE, ...(data as Prisma.AiSettingUncheckedCreateInput) },
      update: data,
    });
    return this.pagespeedView();
  }

  seoClient(seo: { apiKey: string; model: string }): GeminiProvider {
    return new GeminiProvider({
      apiKey: seo.apiKey,
      model: seo.model,
      embeddingModel: 'text-embedding-004',
      embeddingDim: 768,
    });
  }

  private seoGeminiView(row: AiSettingRow | null): AiSettingsView['seoGemini'] {
    const apiKey = this.decrypt(row?.seoGeminiApiKeyEnc);
    return {
      model: row?.seoGeminiModel?.trim() || 'gemini-2.5-flash',
      hasKey: Boolean(apiKey),
      keyPreview: keyPreview(apiKey),
      keySource: row?.seoGeminiApiKeyEnc ? 'db' : null,
    };
  }

  /** Test kết nối provider (mặc định: provider đang lưu). Chạy 1 call nhỏ. */
  async testConnection(provider?: AiProviderKind): Promise<TestAiConnectionResponse> {
    const resolved = await this.resolveConfig();
    if (provider) resolved.provider = provider;
    const target = resolved.provider as AiProviderKind;
    const model = this.modelFor(resolved);

    // Provider thật nhưng thiếu key → báo lỗi rõ ràng (không âm thầm test mock).
    if (target !== AiProviderKind.Mock && !this.keyFor(resolved, target)) {
      return {
        ok: false,
        provider: target,
        model,
        latencyMs: 0,
        message: `Chưa cấu hình API key cho ${target}.`,
      };
    }

    const built = buildAiProvider(resolved);
    const sample: JobModerationInput = {
      title: 'Kỹ sư kiểm thử kết nối AI Gateway',
      description:
        'Đây là bài kiểm tra kết nối AI Gateway của inlink. Nội dung hợp lệ, đúng ngữ cảnh B2B công nghiệp và đủ dài để vượt qua bộ lọc tĩnh khi kiểm thử provider.',
      requirements: 'Không yêu cầu — đây chỉ là mẫu kiểm thử.',
      benefits: null,
      companyName: 'inlink',
      staticFilterNote: null,
    };

    const started = Date.now();
    try {
      const result = await built.provider.moderateJobPosting(sample);
      return {
        ok: true,
        provider: target,
        model,
        latencyMs: Date.now() - started,
        message: `Kết nối thành công (risk=${result.risk_score}).`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: target,
        model,
        latencyMs: Date.now() - started,
        message: this.shortError(err),
      };
    }
  }

  private keyFor(cfg: ResolvedAiConfig, provider: AiProviderKind): string | undefined {
    switch (provider) {
      case AiProviderKind.OpenAi:
        return cfg.openaiApiKey;
      case AiProviderKind.Anthropic:
        return cfg.anthropicApiKey;
      case AiProviderKind.Gemini:
        return cfg.geminiApiKey;
      default:
        return undefined;
    }
  }

  private modelFor(cfg: ResolvedAiConfig): string {
    switch (cfg.provider) {
      case 'openai':
        return cfg.openaiModel;
      case 'anthropic':
        return cfg.anthropicModel;
      case 'gemini':
        return cfg.geminiModel;
      default:
        return 'mock';
    }
  }

  private shortError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
  }
}
