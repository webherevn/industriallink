import { Module, type OnModuleInit } from '@nestjs/common';
import { DomainEvents, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { CompanyModule } from '../company/company.module';
import { NotificationModule } from '../notification/notification.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { JobController } from './job.controller';
import { JobExpiryService } from './job-expiry.service';
import { JobService } from './job.service';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { AdminJobsController } from './admin-jobs/admin-jobs.controller';
import { AdminJobsService } from './admin-jobs/admin-jobs.service';
import { AdminReportsController } from './admin-reports/admin-reports.controller';
import { AdminReportsService } from './admin-reports/admin-reports.service';
import { JobModerationController } from './moderation/job-moderation.controller';
import { JobModerationService } from './moderation/job-moderation.service';
import { JobModerationWorker } from './moderation/job-moderation.worker';
import { jobModerationQueueProvider } from './moderation/job-moderation.queue';

@Module({
  imports: [AiModule, KnowledgeModule, CompanyModule, BillingModule, NotificationModule],
  controllers: [
    JobController,
    AdminJobsController,
    AdminReportsController,
    JobModerationController,
    ApplicationController,
    MatchingController,
    InterviewController,
    OfferController,
    OnboardingController,
  ],
  providers: [
    JobService,
    JobExpiryService,
    AdminJobsService,
    AdminReportsService,
    JobModerationService,
    JobModerationWorker,
    jobModerationQueueProvider,
    ApplicationService,
    MatchingService,
    InterviewService,
    OfferService,
    OnboardingService,
  ],
  exports: [
    JobService,
    JobModerationService,
    ApplicationService,
    MatchingService,
    InterviewService,
    OfferService,
    OnboardingService,
  ],
})
export class RecruitmentModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly jobs: JobService,
  ) {}

  onModuleInit(): void {
    // (A3) Tin tuyển dụng được gắn gói tin đăng → đưa vào hàng đợi kiểm duyệt
    // (KHÔNG publish thẳng). Sự kiện phát từ module Billing để tránh phụ thuộc vòng.
    this.events.subscribe(DomainEvents.JobPackageApplied, (event: DomainEventEnvelope) => {
      const payload = event.payload as { jobId?: string };
      if (!payload.jobId) return;
      return this.jobs.enqueueModeration(
        payload.jobId,
        event.tenantId,
        event.correlationId,
      );
    });
  }
}
