import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { AppConfig } from '../../../config/configuration';
import { buildBullConnection } from '../../candidate/resume/resume-parse.queue';
import {
  JOB_MODERATION_QUEUE,
  JOB_MODERATION_QUEUE_TOKEN,
} from './job-moderation.constants';

/** Hàng đợi BullMQ cho kiểm duyệt tin tuyển dụng (Lớp 2 - Gemini). */
export const jobModerationQueueProvider: Provider = {
  provide: JOB_MODERATION_QUEUE_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): Queue =>
    new Queue(JOB_MODERATION_QUEUE, {
      connection: buildBullConnection(config),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 1000,
      },
    }),
};
