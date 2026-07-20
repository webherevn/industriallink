import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CopilotService } from './copilot.service';
import { CopilotChatDto } from './dto/copilot-chat.dto';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('AI Copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai/copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('chat')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({
    summary: 'RAG Copilot: hỏi đáp tuyển dụng dựa trên pipeline / tin / ứng viên nội bộ',
  })
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: CopilotChatDto) {
    return this.copilot.chat(user, dto.message);
  }
}
