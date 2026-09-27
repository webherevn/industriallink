import { createSign } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompanyStatus,
  JobStatus,
  jobPublicPath,
  type IndexingNotificationType,
  type IndexingSettingsView,
  type IndexingSubmitItem,
  type IndexingSubmitRequest,
  type IndexingSubmitResult,
  type IndexingTestResult,
  type UpdateIndexingSettingsRequest,
} from '@industriallink/contracts';
import type { AppConfig } from '../../config/configuration';
import { decryptSecret, encryptSecret } from '../../modules/ai/ai-settings.cipher';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

export const INDEXING_QUOTA_LIMIT = 200;

const SCOPE = 'default';
const SETTINGS_TTL_MS = 60_000;
const SUBMIT_CONCURRENCY = 4;

interface ServiceAccount {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

interface ResolvedSettings {
  creds: ServiceAccount | null;
  source: 'db' | 'env' | null;
  autoNotify: boolean;
  updatedAt: Date | null;
}

@Injectable()
export class GoogleIndexingService {
  private readonly logger = new Logger(GoogleIndexingService.name);
  private settingsCache: { at: number; value: ResolvedSettings } | null = null;
  private tokenCache: { email: string; token: string; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  async isConfigured(): Promise<boolean> {
    return (await this.settings()).creds !== null;
  }

  async notifyJob(
    job: { slug?: string | null; id: string; industry?: string | null },
    type: IndexingNotificationType,
  ): Promise<void> {
    const url = `${this.siteUrl()}${jobPublicPath(job)}`;
    await this.publish(url, type);
  }

  /** Gửi tự động khi nội dung đổi trạng thái. Bỏ qua nếu chưa có khóa hoặc tắt tự gửi. */
  async publish(url: string, type: IndexingNotificationType): Promise<void> {
    const settings = await this.settings();
    if (!settings.creds) {
      this.logger.debug(`Bỏ qua Google Indexing API (${type}): chưa có khóa service account`);
      return;
    }
    if (!settings.autoNotify) {
      this.logger.debug(`Bỏ qua Google Indexing API (${type}): đang tắt tự gửi`);
      return;
    }
    if (this.siteIsLocal()) {
      this.logger.debug(`Bỏ qua Google Indexing API (${type}): site đang là localhost`);
      return;
    }
    await this.send(url, type, settings.creds);
  }

  async settingsView(): Promise<IndexingSettingsView> {
    const settings = await this.settings(true);
    return {
      hasCredentials: settings.creds !== null,
      source: settings.source,
      clientEmail: settings.creds?.client_email ?? null,
      projectId: settings.creds?.project_id ?? null,
      autoNotify: settings.autoNotify,
      siteUrl: this.siteUrl(),
      siteIsLocal: this.siteIsLocal(),
      updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
    };
  }

  async updateSettings(dto: UpdateIndexingSettingsRequest, adminId: string): Promise<IndexingSettingsView> {
    const data: { updatedBy: string; indexingCredentialsEnc?: string | null; indexingAutoNotify?: boolean } = {
      updatedBy: adminId,
    };
    if (dto.credentialsJson === null) {
      data.indexingCredentialsEnc = null;
    } else if (typeof dto.credentialsJson === 'string' && dto.credentialsJson.trim()) {
      const parsed = parseServiceAccount(dto.credentialsJson.trim());
      if (!parsed.ok) throw new BadRequestException(parsed.error);
      data.indexingCredentialsEnc = encryptSecret(JSON.stringify(parsed.value), this.encryptionSecret());
    }
    if (dto.autoNotify !== undefined) data.indexingAutoNotify = dto.autoNotify;
    await this.prisma.aiSetting.upsert({
      where: { scope: SCOPE },
      create: { scope: SCOPE, ...data },
      update: data,
    });
    this.settingsCache = null;
    this.tokenCache = null;
    return this.settingsView();
  }

  /** Lấy token rồi đọc metadata trang chủ: 404 = đã có quyền, 403 = chưa là Chủ sở hữu. */
  async test(): Promise<IndexingTestResult> {
    const settings = await this.settings(true);
    const creds = settings.creds;
    const clientEmail = creds?.client_email ?? null;
    if (!creds) {
      return {
        ok: false,
        step: 'credentials',
        clientEmail,
        url: null,
        statusCode: null,
        message: 'Chưa có khóa service account.',
      };
    }
    let token: string;
    try {
      token = await this.accessToken(creds);
    } catch (err) {
      const detail = String(err instanceof Error ? err.message : err);
      const message = /account not found/i.test(detail)
        ? 'Google không tìm thấy service account này — account đã bị xoá hoặc file JSON không đúng project. Tạo khóa JSON mới.'
        : /invalid_grant|Invalid JWT Signature/i.test(detail)
          ? 'Khóa đã bị thu hồi hoặc giờ máy chủ lệch. Tạo khóa JSON mới trong tab Keys và lưu lại.'
          : `Google không cấp token: ${detail.slice(0, 240)}. Kiểm tra lại file JSON hoặc tạo khóa mới.`;
      return { ok: false, step: 'token', clientEmail, url: null, statusCode: null, message };
    }
    if (this.siteIsLocal()) {
      return {
        ok: true,
        step: 'token',
        clientEmail,
        url: null,
        statusCode: null,
        message: 'Khóa hợp lệ, Google đã cấp token. Site đang chạy localhost nên chưa kiểm tra được quyền Search Console — thử lại trên inlink.vn.',
      };
    }
    const url = `${this.siteUrl()}/`;
    try {
      const res = await fetch(
        `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) },
      );
      const body = await res.text();
      if (res.ok || res.status === 404) {
        return {
          ok: true,
          step: 'ownership',
          clientEmail,
          url,
          statusCode: res.status,
          message: 'Kết nối thành công. Service account đã là Chủ sở hữu trong Search Console, có thể gửi URL.',
        };
      }
      return {
        ok: false,
        step: 'ownership',
        clientEmail,
        url,
        statusCode: res.status,
        message: explainGoogleError(res.status, body, clientEmail),
      };
    } catch (err) {
      return {
        ok: false,
        step: 'ownership',
        clientEmail,
        url,
        statusCode: null,
        message: `Không gọi được Indexing API: ${String(err).slice(0, 200)}`,
      };
    }
  }

  async quotaUsedToday(): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n
        FROM shared.indexing_notification
        WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')
      `;
      return Number(rows[0]?.n) || 0;
    } catch {
      return 0;
    }
  }

  /** Gửi thủ công (bỏ qua công tắc tự gửi), dừng khi hết quota ngày hoặc Google trả 429. */
  async submit(dto: IndexingSubmitRequest): Promise<IndexingSubmitResult> {
    const settings = await this.settings(true);
    if (!settings.creds) throw new BadRequestException('Chưa có khóa service account Google Indexing.');
    if (this.siteIsLocal()) {
      throw new BadRequestException('Site đang là localhost. Google chỉ nhận URL của domain đã xác minh (inlink.vn).');
    }
    const type: IndexingNotificationType = dto.type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED';
    const urls = dto.target === 'jobs' ? await this.jobUrls() : this.normalizeUrls(dto.urls ?? []);
    if (urls.length === 0) {
      throw new BadRequestException(
        dto.target === 'jobs' ? 'Không có tin tuyển dụng nào đang hiển thị.' : 'Chưa có URL hợp lệ thuộc domain của site.',
      );
    }

    const used = await this.quotaUsedToday();
    const left = Math.max(0, INDEXING_QUOTA_LIMIT - used);
    const queue = urls.slice(0, left);
    const items: IndexingSubmitItem[] = [];
    let stopped = false;
    let next = 0;
    const worker = async () => {
      while (!stopped && next < queue.length) {
        const url = queue[next++]!;
        const item = await this.send(url, type, settings.creds!);
        items.push(item);
        if (item.statusCode === 429) stopped = true;
      }
    };
    await Promise.all(Array.from({ length: Math.min(SUBMIT_CONCURRENCY, queue.length) }, worker));

    const sent = items.filter((item) => item.ok).length;
    return {
      requested: urls.length,
      sent,
      failed: items.length - sent,
      skipped: urls.length - items.length,
      quotaLeft: Math.max(0, left - items.length),
      items: items.sort((a, b) => Number(a.ok) - Number(b.ok)),
    };
  }

  private async send(url: string, type: IndexingNotificationType, creds: ServiceAccount): Promise<IndexingSubmitItem> {
    let statusCode: number | null = null;
    let ok = false;
    let error: string | null = null;
    try {
      const token = await this.accessToken(creds);
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
        signal: AbortSignal.timeout(20_000),
      });
      statusCode = res.status;
      if (!res.ok) {
        error = explainGoogleError(res.status, await res.text(), creds.client_email ?? null).slice(0, 300);
        this.logger.warn(`Indexing API ${type} ${res.status}: ${error}`);
      } else {
        ok = true;
        this.logger.log(`Indexing API ${type} ${url}`);
      }
    } catch (err) {
      error = String(err).slice(0, 300);
      this.logger.warn(`Indexing API lỗi: ${error}`);
    }
    await this.record(url, type, statusCode, ok, error);
    return { url, ok, statusCode, error };
  }

  private async jobUrls(): Promise<string[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        isDeleted: false,
        status: JobStatus.Published,
        company: { isDeleted: false, status: CompanyStatus.Active },
      },
      select: { slug: true, id: true, industry: true },
      orderBy: { updatedAt: 'desc' },
      take: INDEXING_QUOTA_LIMIT,
    });
    const base = this.siteUrl();
    return jobs.map((job) => `${base}${jobPublicPath(job)}`);
  }

  private normalizeUrls(raw: string[]): string[] {
    const base = this.siteUrl();
    const host = new URL(base).hostname.replace(/^www\./, '');
    const out = new Set<string>();
    for (const item of raw) {
      const value = item.trim();
      if (!value) continue;
      if (value.startsWith('/') && !value.startsWith('//')) {
        out.add(`${base}${value.split('#')[0]}`);
        continue;
      }
      try {
        const url = new URL(value);
        if (url.hostname.replace(/^www\./, '') !== host) continue;
        url.hash = '';
        out.add(url.toString());
      } catch {
        // bỏ dòng không phải URL
      }
    }
    return [...out].slice(0, INDEXING_QUOTA_LIMIT);
  }

  private async record(
    url: string,
    type: IndexingNotificationType,
    statusCode: number | null,
    ok: boolean,
    error: string | null,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO shared.indexing_notification (id, url, type, status_code, ok, error)
        VALUES (gen_random_uuid(), ${url.slice(0, 600)}, ${type}, ${statusCode}, ${ok}, ${error})
      `;
    } catch (err) {
      this.logger.warn(`Không ghi nhật ký Indexing API: ${String(err)}`);
    }
  }

  private siteUrl(): string {
    return this.config.get('seo', { infer: true }).siteUrl.replace(/\/$/, '');
  }

  private siteIsLocal(): boolean {
    try {
      const host = new URL(this.siteUrl()).hostname;
      return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    } catch {
      return true;
    }
  }

  private encryptionSecret(): string {
    const ai = this.config.get('ai', { infer: true });
    return ai.settingsEncryptionKey || this.config.get('jwt', { infer: true }).accessSecret;
  }

  /** Khóa trong admin đè biến môi trường GOOGLE_INDEXING_CREDENTIALS_JSON. */
  private async settings(fresh = false): Promise<ResolvedSettings> {
    if (!fresh && this.settingsCache && Date.now() - this.settingsCache.at < SETTINGS_TTL_MS) {
      return this.settingsCache.value;
    }
    let row: { indexingCredentialsEnc: string | null; indexingAutoNotify: boolean; updatedAt: Date } | null = null;
    try {
      row = await this.prisma.aiSetting.findUnique({
        where: { scope: SCOPE },
        select: { indexingCredentialsEnc: true, indexingAutoNotify: true, updatedAt: true },
      });
    } catch (err) {
      this.logger.warn(`Không đọc được cài đặt Indexing, dùng env: ${String(err)}`);
    }

    let creds: ServiceAccount | null = null;
    let source: ResolvedSettings['source'] = null;
    if (row?.indexingCredentialsEnc) {
      try {
        const parsed = parseServiceAccount(decryptSecret(row.indexingCredentialsEnc, this.encryptionSecret()));
        if (parsed.ok) {
          creds = parsed.value;
          source = 'db';
        }
      } catch (err) {
        this.logger.error(`Giải mã khóa Indexing thất bại (khoá mã hoá đổi?): ${String(err)}`);
      }
    }
    if (!creds) {
      const raw = this.config.get('seo', { infer: true }).indexingCredentialsJson;
      if (raw?.trim()) {
        const parsed = parseServiceAccount(raw);
        if (parsed.ok) {
          creds = parsed.value;
          source = 'env';
        } else {
          this.logger.warn(`GOOGLE_INDEXING_CREDENTIALS_JSON không hợp lệ: ${parsed.error}`);
        }
      }
    }
    const value: ResolvedSettings = {
      creds,
      source,
      autoNotify: row?.indexingAutoNotify ?? true,
      updatedAt: row?.updatedAt ?? null,
    };
    this.settingsCache = { at: Date.now(), value };
    return value;
  }

  private async accessToken(creds: ServiceAccount): Promise<string> {
    const cached = this.tokenCache;
    if (cached && cached.email === creds.client_email && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }
    const now = Math.floor(Date.now() / 1000);
    const jwt = signRs256(
      {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      creds.private_key!,
    );
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      throw new Error(`OAuth token ${res.status} ${body}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    this.tokenCache = {
      email: creds.client_email!,
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  }
}

function parseServiceAccount(raw: string): { ok: true; value: ServiceAccount } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Không phải JSON hợp lệ. Dán nguyên nội dung file .json tải từ Google Cloud.' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'JSON phải là object service account.' };
  const obj = parsed as Record<string, unknown>;
  if (obj.type !== undefined && obj.type !== 'service_account') {
    return { ok: false, error: 'File JSON không phải khóa service account (type phải là "service_account").' };
  }
  const email = typeof obj.client_email === 'string' ? obj.client_email.trim() : '';
  const key = typeof obj.private_key === 'string' ? obj.private_key.replace(/\\n/g, '\n') : '';
  if (!email.endsWith('.gserviceaccount.com')) {
    return { ok: false, error: 'Thiếu client_email của service account (…@….iam.gserviceaccount.com).' };
  }
  if (!key.includes('BEGIN PRIVATE KEY')) return { ok: false, error: 'Thiếu private_key trong file JSON.' };
  return {
    ok: true,
    value: {
      client_email: email,
      private_key: key,
      project_id: typeof obj.project_id === 'string' ? obj.project_id : undefined,
    },
  };
}

function explainGoogleError(status: number, body: string, clientEmail: string | null): string {
  const text = body.replace(/\s+/g, ' ');
  if (status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(text)) {
    return 'Web Search Indexing API chưa được bật trong Google Cloud project của service account. Bật API rồi đợi vài phút.';
  }
  if (status === 403) {
    return `Service account chưa là Chủ sở hữu (Owner) của property inlink.vn trong Search Console. Thêm ${clientEmail ?? 'email service account'} với quyền Chủ sở hữu.`;
  }
  if (status === 429) return 'Google từ chối vì vượt hạn mức (429). Thử lại vào ngày mai.';
  if (status === 401) return 'Token không hợp lệ (401). Tạo khóa JSON mới và lưu lại.';
  return `Google trả ${status}: ${text.slice(0, 200)}`;
}

function signRs256(payload: Record<string, unknown>, privateKey: string): string {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = encode(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${signer.sign(privateKey, 'base64url')}`;
}
