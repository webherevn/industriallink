import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillService } from './skill.service';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly skills: SkillService) {}

  @Get('skills')
  @ApiOperation({ summary: 'Danh mục kỹ năng chuẩn (Taxonomy)' })
  listSkills() {
    return this.skills.list();
  }
}
