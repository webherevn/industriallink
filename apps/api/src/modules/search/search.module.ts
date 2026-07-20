import { Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { AiModule } from '../ai/ai.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Search Domain. Lắng nghe CandidateUpdated để cập nhật chỉ mục
 * (đồng bộ qua sự kiện, không cập nhật chéo trực tiếp giữa các Domain).
 */
@Module({
  imports: [AiModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly search: SearchService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DomainEvents.CandidateUpdated, (event: DomainEventEnvelope) => {
      const payload = event.payload as { candidateId: string };
      return this.search.indexCandidate(payload.candidateId);
    });
  }
}
