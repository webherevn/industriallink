import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CreateOnboardingDto, UpdateOnboardingDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('onboardings')
export class OnboardingController {
  constructor(private readonly onboardings: OnboardingService) {}

  @Post()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Bắt đầu onboarding nhân sự mới + email hướng dẫn' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOnboardingDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.onboardings.start(user, dto, correlationId);
  }

  @Get()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Danh sách onboarding của công ty' })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
  ) {
    return this.onboardings.listForCompany(user, { jobId, status });
  }

  @Get('mine')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Onboarding của tôi (ứng viên / nhân sự mới)' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardings.listMine(user);
  }

  @Patch(':id')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Cập nhật tiến độ onboarding' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOnboardingDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.onboardings.update(user, id, dto, correlationId);
  }
}
