import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import type { AppConfig } from '../../../config/configuration';
import { RESUME_PARSE_QUEUE, type ResumeParseJobData } from './queue.constants';
import { buildBullConnection } from './resume-parse.queue';
import { ResumeParseService } from './resume-parse.service';

/**
 * Worker tiêu thụ job phân tích CV. Tách hạ tầng queue khỏi logic nghiệp vụ
 * (ResumeParseService). BullMQ tự quản lý kết nối Redis riêng cho worker.
 */
@Injectable()
export class ResumeParseWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResumeParseWorker.name);
  private worker?: Worker<ResumeParseJobData>;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly service: ResumeParseService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ResumeParseJobData>(
      RESUME_PARSE_QUEUE,
      async (job: Job<ResumeParseJobData>) => {
        await this.service.process(job.data);
      },
      { connection: buildBullConnection(this.config), concurrency: 4 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} thất bại: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
