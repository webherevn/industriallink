import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DomainEvents, JobStatus } from '@industriallink/contracts';
import { createDomainEvent } from '../../shared/domain/domain-event';
import { VN_TIME_ZONE, toVnCalendarDate, vnDateString } from '../../shared/domain/vn-date.util';
import { AppEventBus } from '../../shared/events/event-bus';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';

const BATCH = 500;

/**
 * Tự đóng tin đang công khai đã qua hạn nộp (deadline là ngày cuối còn nhận hồ sơ, giờ VN).
 * Chạy đầu mỗi giờ (bao gồm đúng 00:00:00 nửa đêm giờ VN) để không bỏ sót nếu API tắt đúng lúc nửa đêm; idempotent.
 */
@Injectable()
export class JobExpiryService {
  private readonly logger = new Logger(JobExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AppEventBus,
    private readonly indexing: GoogleIndexingService,
  ) {}

  @Cron('0 0 * * * *', { timeZone: VN_TIME_ZONE })
  async closeExpiredJobs(now: Date = new Date()): Promise<number> {
    const todayVn = vnDateString(now);
    const cutoff = toVnCalendarDate(now);

    const expired = await this.prisma.job.findMany({
      where: { isDeleted: false, status: JobStatus.Published, deadline: { lt: cutoff } },
      select: { id: true, tenantId: true, code: true, title: true, slug: true, industry: true },
      take: BATCH,
    });
    if (expired.length === 0) return 0;

    await this.prisma.job.updateMany({
      where: { id: { in: expired.map((j) => j.id) }, status: JobStatus.Published },
      data: { status: JobStatus.Closed },
    });

    for (const job of expired) {
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.JobUpdated,
          tenantId: job.tenantId,
          correlationId: 'job-expiry-cron',
          payload: { jobId: job.id, code: job.code, title: job.title, status: JobStatus.Closed },
        }),
      );
      void this.indexing.notifyJob(job, 'URL_DELETED');
    }

    this.logger.log(`Đã đóng ${expired.length} tin hết hạn nộp (trước ${todayVn}).`);
    return expired.length;
  }
}
