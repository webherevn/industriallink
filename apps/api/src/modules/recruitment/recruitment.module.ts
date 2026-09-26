import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CompanyModule } from '../company/company.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { OfferController } from './offer.controller';
import { OfferService } from './offer.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { JobModerationController } from './moderation/job-moderation.controller';
import { JobModerationService } from './moderation/job-moderation.service';
import { JobModerationWorker } from './moderation/job-moderation.worker';
import { jobModerationQueueProvider } from './moderation/job-moderation.queue';

@Module({
  imports: [AiModule, KnowledgeModule, CompanyModule],
  controllers: [
    JobController,
    JobModerationController,
    ApplicationController,
    MatchingController,
    InterviewController,
    OfferController,
    OnboardingController,
  ],
  providers: [
    JobService,
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
export class RecruitmentModule {}
