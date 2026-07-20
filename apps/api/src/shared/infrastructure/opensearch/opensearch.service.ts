import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import type { AppConfig } from '../../../config/configuration';

export type CandidateSearchHit = {
  candidateId: string;
  score: number;
};

const INDEX = 'candidates';

/**
 * OpenSearch Gateway — chỉ mục projection cho AI Search.
 * Postgres/pgvector vẫn là nguồn chính; OpenSearch lỗi → caller fallback.
 */
@Injectable()
export class OpenSearchService implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchService.name);
  private readonly client: Client | null;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const os = this.config.get('opensearch', { infer: true });
    this.enabled = os.enabled;
    this.client = os.enabled
      ? new Client({
          node: os.node,
          ssl: { rejectUnauthorized: false },
        })
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled || !this.client) {
      this.logger.log('OpenSearch tắt (OPENSEARCH_ENABLED=false)');
      return;
    }
    try {
      const health = await this.client.cluster.health({});
      this.logger.log(`OpenSearch sẵn sàng status=${health.body.status}`);
      await this.ensureIndex();
    } catch (err) {
      this.logger.warn(
        `OpenSearch chưa kết nối được (${String(err)}). Search sẽ dùng Postgres.`,
      );
    }
  }

  async ping(): Promise<boolean> {
    if (!this.enabled || !this.client) return false;
    try {
      await this.client.cluster.health({ timeout: '2s' });
      return true;
    } catch {
      return false;
    }
  }

  async indexCandidate(doc: {
    candidateId: string;
    tenantId: string;
    searchText: string;
    displayName: string;
  }): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.ensureIndex();
      await this.client.index({
        index: INDEX,
        id: doc.candidateId,
        body: {
          candidateId: doc.candidateId,
          tenantId: doc.tenantId,
          searchText: doc.searchText,
          displayName: doc.displayName,
          updatedAt: new Date().toISOString(),
        },
        refresh: true,
      });
    } catch (err) {
      this.logger.warn(`OpenSearch index ${doc.candidateId} thất bại: ${String(err)}`);
    }
  }

  async searchCandidates(
    query: string,
    tenantId: string,
    size = 20,
  ): Promise<CandidateSearchHit[]> {
    if (!this.enabled || !this.client) return [];
    try {
      const res = await this.client.search({
        index: INDEX,
        body: {
          size,
          query: {
            bool: {
              filter: [{ term: { tenantId } }],
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['searchText^2', 'displayName'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
        },
      });

      const rawHits = res.body.hits?.hits ?? [];
      const hits = rawHits as unknown as Array<{
        _id: string;
        _score?: number | null;
        _source?: { candidateId?: string };
      }>;

      const maxScore = Math.max(
        1,
        ...hits.map((h) => (typeof h._score === 'number' ? h._score : 0)),
      );

      return hits.map((h) => {
        const raw = typeof h._score === 'number' ? h._score : 0;
        return {
          candidateId: h._source?.candidateId ?? h._id,
          score: Math.max(0.15, Math.min(1, raw / maxScore)),
        };
      });
    } catch (err) {
      this.logger.warn(`OpenSearch search lỗi: ${String(err)}`);
      return [];
    }
  }

  private async ensureIndex(): Promise<void> {
    if (!this.client) return;
    const exists = await this.client.indices.exists({ index: INDEX });
    if (exists.body === true) return;
    await this.client.indices.create({
      index: INDEX,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            candidateId: { type: 'keyword' },
            tenantId: { type: 'keyword' },
            searchText: { type: 'text' },
            displayName: { type: 'text' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });
    this.logger.log(`Đã tạo index OpenSearch «${INDEX}»`);
  }
}
