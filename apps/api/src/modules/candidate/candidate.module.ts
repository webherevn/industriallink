import { Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { AiModule } from '../ai/ai.module';
import { CompanyModule } from '../company/company.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotificationModule } from '../notification/notification.module';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { resumeParseQueueProvider } from './resume/resume-parse.queue';
import { ResumeParseService } from './resume/resume-parse.service';
import { ResumeParseWorker } from './resume/resume-parse.worker';

/**
 * Candidate Domain. Lắng nghe UserRegistered để tạo hồ sơ ứng viên (event-driven,
 * không phụ thuộc trực tiếp Identity Domain).
 */
@Module({
  imports: [AiModule, KnowledgeModule, CompanyModule, NotificationModule],
  controllers: [CandidateController],
  providers: [
    CandidateService,
    ResumeParseService,
    ResumeParseWorker,
    resumeParseQueueProvider,
  ],
  exports: [CandidateService],
})
export class CandidateModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly candidates: CandidateService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DomainEvents.UserRegistered, (event: DomainEventEnvelope) => {
      const payload = event.payload as {
        userId: string;
        displayName: string;
        role: string;
      };
      return this.candidates.createForUser({
        userId: payload.userId,
        displayName: payload.displayName,
        role: payload.role,
        tenantId: event.tenantId,
      });
    });
  }
}
