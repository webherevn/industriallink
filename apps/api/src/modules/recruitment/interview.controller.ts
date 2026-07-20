import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto';
import { InterviewService } from './interview.service';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interviews')
export class InterviewController {
  constructor(private readonly interviews: InterviewService) {}

  @Post()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Đặt lịch phỏng vấn cho hồ sơ ứng tuyển' })
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.interviews.schedule(user, dto, correlationId);
  }

  @Get()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Danh sách lịch phỏng vấn công ty (lịch / khoảng thời gian)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
  ) {
    return this.interviews.listForCompany(user, { from, to, jobId, status });
  }

  @Get('stats')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Thống kê PV hôm nay (dashboard)' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.interviews.statsForCompany(user);
  }

  @Get('mine')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Lịch phỏng vấn của tôi (ứng viên)' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.interviews.listMine(user);
  }

  @Patch(':id')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Cập nhật / huỷ / hoàn thành lịch phỏng vấn' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.interviews.update(user, id, dto, correlationId);
  }
}
