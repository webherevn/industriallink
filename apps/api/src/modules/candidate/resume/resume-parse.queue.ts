import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectionOptions, Queue } from 'bullmq';
import type { AppConfig } from '../../../config/configuration';
import { RESUME_PARSE_QUEUE, RESUME_PARSE_QUEUE_TOKEN } from './queue.constants';

/** Tạo ConnectionOptions cho BullMQ từ cấu hình Redis. */
export function buildBullConnection(config: ConfigService<AppConfig, true>): ConnectionOptions {
  const redis = config.get('redis', { infer: true });
  return {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    maxRetriesPerRequest: null,
  };
}

/** Hàng đợi BullMQ cho job phân tích CV. */
export const resumeParseQueueProvider: Provider = {
  provide: RESUME_PARSE_QUEUE_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): Queue =>
    new Queue(RESUME_PARSE_QUEUE, {
      connection: buildBullConnection(config),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
};
