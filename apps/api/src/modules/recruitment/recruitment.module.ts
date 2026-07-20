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

@Module({
  imports: [AiModule, KnowledgeModule, CompanyModule],
  controllers: [
    JobController,
    ApplicationController,
    MatchingController,
    InterviewController,
    OfferController,
    OnboardingController,
  ],
  providers: [
    JobService,
    ApplicationService,
    MatchingService,
    InterviewService,
    OfferService,
    OnboardingService,
  ],
  exports: [
    JobService,
    ApplicationService,
    MatchingService,
    InterviewService,
    OfferService,
    OnboardingService,
  ],
})
export class RecruitmentModule {}
