import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppConfig } from '../../../config/configuration';

/**
 * Lưu trữ file qua S3/MinIO hoặc đĩa local (`STORAGE_DRIVER=local`).
 * DB chỉ lưu metadata + storageKey.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly driver: 's3' | 'local';
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const s3 = this.config.get('s3', { infer: true });
    this.bucket = s3.bucket;
    this.driver = s3.driver;
    this.localRoot = s3.localPath;
    this.client =
      this.driver === 's3'
        ? new S3Client({
            endpoint: s3.endpoint,
            region: s3.region,
            forcePathStyle: s3.forcePathStyle,
            credentials: {
              accessKeyId: s3.accessKey,
              secretAccessKey: s3.secretKey,
            },
          })
        : null;
  }

  async onModuleInit(): Promise<void> {
    if (this.driver === 'local') {
      await mkdir(this.localRoot, { recursive: true });
      this.logger.log(`Object Storage dùng đĩa local: ${this.localRoot}`);
      return;
    }
    if (!this.client) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Đã tạo bucket ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`Chưa sẵn sàng Object Storage (MinIO/S3): ${String(err)}`);
      }
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.driver === 'local') {
      const full = join(this.localRoot, key);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, body);
      return;
    }
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Object Storage chưa cấu hình. Đặt STORAGE_DRIVER=local hoặc bật MinIO.',
      );
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(`putObject thất bại key=${key}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Không lưu được file CV (MinIO/S3 không kết nối được). Kiểm tra STORAGE_DRIVER / S3_ENDPOINT hoặc bật MinIO trên server.',
      );
    }
  }

  async getObject(key: string): Promise<Buffer> {
    if (this.driver === 'local') {
      try {
        return await readFile(join(this.localRoot, key));
      } catch {
        throw new ServiceUnavailableException(`Không đọc được file local: ${key}`);
      }
    }
    if (!this.client) {
      throw new ServiceUnavailableException('Object Storage chưa cấu hình.');
    }
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) {
        throw new Error(`Không đọc được object ${key}`);
      }
      return Buffer.from(bytes);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`getObject thất bại key=${key}: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Không đọc được file từ Object Storage. Kiểm tra MinIO/S3 trên server.',
      );
    }
  }
}
