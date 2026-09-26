import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JobModerationStatus, JobStatus, UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../../shared/security/security.types';
import { AdminJobsService } from './admin-jobs.service';
import { AdminJobActionDto } from './dto/admin-job-action.dto';

@ApiTags('Admin Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/jobs')
export class AdminJobsController {
  constructor(private readonly adminJobs: AdminJobsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách mọi tin tuyển dụng (SuperAdmin)' })
  @ApiQuery({ name: 'status', required: false, enum: JobStatus })
  @ApiQuery({ name: 'moderationStatus', required: false, enum: JobModerationStatus })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('status') status?: JobStatus,
    @Query('moderationStatus') moderationStatus?: JobModerationStatus,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminJobs.list({
      status,
      moderationStatus,
      companyId: companyId || undefined,
      q: q || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/action')
  @ApiOperation({ summary: 'Ẩn / hiện / đóng / đẩy lại hàng đợi kiểm duyệt' })
  act(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminJobActionDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adminJobs.act(user, id, dto.action, correlationId, dto.note);
  }
}
