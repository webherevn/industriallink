import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { SkillService } from './skill.service';

@Module({
  controllers: [KnowledgeController],
  providers: [SkillService],
  exports: [SkillService],
})
export class KnowledgeModule {}
