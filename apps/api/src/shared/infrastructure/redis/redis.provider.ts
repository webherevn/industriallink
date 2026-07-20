import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';
import type { AppConfig } from '../../../config/configuration';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Kết nối Redis dùng chung cho cache và BullMQ.
 * maxRetriesPerRequest = null là yêu cầu bắt buộc của BullMQ.
 */
export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): Redis => {
    const redis = config.get('redis', { infer: true });
    return new IORedis({
      host: redis.host,
      port: redis.port,
      password: redis.password,
      maxRetriesPerRequest: null,
    });
  },
};
