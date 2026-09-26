import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JobModerationStatus, UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../../shared/security/security.types';
import { DecideJobModerationDto } from './dto/decide-job-moderation.dto';
import { JobModerationService } from './job-moderation.service';

@ApiTags('Recruitment - Job Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/job-moderation')
export class JobModerationController {
  constructor(private readonly moderation: JobModerationService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Hàng đợi kiểm duyệt tin (mặc định: cần duyệt tay)' })
  @ApiQuery({ name: 'status', required: false, enum: JobModerationStatus })
  @ApiQuery({ name: 'limit', required: false })
  listQueue(
    @Query('status') status?: JobModerationStatus,
    @Query('limit') limit?: string,
  ) {
    return this.moderation.listQueue({
      status,
      limit: limit != null && limit !== '' ? Number(limit) : undefined,
    });
  }

  @Post(':id/decide')
  @ApiOperation({ summary: 'Quyết định 1 tin: duyệt / từ chối / khoá tài khoản' })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideJobModerationDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.moderation.decide(user, id, dto, correlationId);
  }
}
