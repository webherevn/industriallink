import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { ApplicationService } from './application.service';
import { UpdateApplicationStatusDto } from './dto/apply-job.dto';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Get('mine')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Các hồ sơ tôi đã ứng tuyển' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.myApplications(user);
  }

  @Get('inbox')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Inbox ứng viên toàn công ty (Recruiter Workspace)' })
  @ApiQuery({ name: 'limit', required: false })
  inbox(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.applications.listCompanyInbox(user, Number.isFinite(n) ? n : 50);
  }

  @Get('workspace-summary')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Tóm tắt Recruiter Workspace' })
  workspaceSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.applications.getWorkspaceSummary(user);
  }

  @Get(':id')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Chi tiết đơn ứng tuyển + timeline trạng thái (ứng viên)' })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applications.getMineDetail(user, id);
  }

  @Patch(':id/status')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Chuyển trạng thái hồ sơ trong pipeline tuyển dụng' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.applications.updateStatus(user, id, dto, correlationId);
  }
}
