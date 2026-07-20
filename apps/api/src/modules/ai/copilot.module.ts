import { Module } from '@nestjs/common';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { SearchModule } from '../search/search.module';
import { AiModule } from './ai.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

/**
 * RAG Copilot — lấy ngữ cảnh từ Recruitment + Search, trả lời qua AI Gateway.
 */
@Module({
  imports: [AiModule, RecruitmentModule, SearchModule],
  controllers: [CopilotController],
  providers: [CopilotService],
})
export class CopilotModule {}
