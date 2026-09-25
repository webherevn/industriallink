import { createSign } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jobPublicPath } from '@industriallink/contracts';
import type { AppConfig } from '../../config/configuration';

type IndexingType = 'URL_UPDATED' | 'URL_DELETED';

interface ServiceAccount {
  client_email?: string;
  private_key?: string;
}

@Injectable()
export class GoogleIndexingService {
  private readonly logger = new Logger(GoogleIndexingService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async notifyJob(
    job: { slug?: string | null; id: string; industry?: string | null },
    type: IndexingType,
  ): Promise<void> {
    const url = `${this.siteUrl()}${jobPublicPath(job)}`;
    await this.publish(url, type);
  }

  async publish(url: string, type: IndexingType): Promise<void> {
    const creds = this.credentials();
    if (!creds) {
      this.logger.debug(
        `Bỏ qua Google Indexing API (${type}): chưa có GOOGLE_INDEXING_CREDENTIALS_JSON`,
      );
      return;
    }
    try {
      const token = await this.accessToken(creds);
      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, type }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Indexing API ${type} ${res.status}: ${body.slice(0, 300)}`);
        return;
      }
      this.logger.log(`Indexing API ${type} ${url}`);
    } catch (err) {
      this.logger.warn(`Indexing API lỗi: ${String(err)}`);
    }
  }

  private siteUrl(): string {
    return this.config.get('seo', { infer: true }).siteUrl.replace(/\/$/, '');
  }

  private credentials(): ServiceAccount | null {
    const raw = this.config.get('seo', { infer: true }).indexingCredentialsJson;
    if (!raw?.trim()) return null;
    try {
      const parsed = JSON.parse(raw) as ServiceAccount;
      if (!parsed.client_email || !parsed.private_key) return null;
      return parsed;
    } catch {
      this.logger.warn('GOOGLE_INDEXING_CREDENTIALS_JSON không phải JSON hợp lệ');
      return null;
    }
  }

  private async accessToken(creds: ServiceAccount): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jwt = signRs256(
      {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/indexing',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      creds.private_key!.replace(/\\n/g, '\n'),
    );
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      throw new Error(`OAuth token ${res.status}`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }
}

function signRs256(payload: Record<string, unknown>, privateKey: string): string {
  const encode = (value: string) => Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = encode(JSON.stringify(payload));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${signer.sign(privateKey, 'base64url')}`;
}
