import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import type { AppConfig } from '../../../config/configuration';
import { buildBullConnection } from '../../candidate/resume/resume-parse.queue';
import {
  JOB_MODERATION_QUEUE,
  JOB_MODERATION_RATE_DURATION_MS,
  JOB_MODERATION_RATE_MAX,
  type JobModerationJobData,
} from './job-moderation.constants';
import { JobModerationService } from './job-moderation.service';

/**
 * Worker tiêu thụ hàng đợi kiểm duyệt tin. concurrency=1 + limiter 10/phút
 * để an toàn hạn mức Gemini Free (15 RPM), tránh HTTP 429.
 */
@Injectable()
export class JobModerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobModerationWorker.name);
  private worker?: Worker<JobModerationJobData>;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly service: JobModerationService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<JobModerationJobData>(
      JOB_MODERATION_QUEUE,
      async (job: Job<JobModerationJobData>) => {
        await this.service.process(job.data);
      },
      {
        connection: buildBullConnection(this.config),
        concurrency: 1,
        limiter: {
          max: JOB_MODERATION_RATE_MAX,
          duration: JOB_MODERATION_RATE_DURATION_MS,
        },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Kiểm duyệt job ${job?.id} thất bại: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
