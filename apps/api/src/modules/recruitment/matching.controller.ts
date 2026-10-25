import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { MatchingService } from './matching.service';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matching')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get('jobs/:id/candidates')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'AI gợi ý ứng viên phù hợp cho tin tuyển dụng (có giải thích)' })
  candidatesForJob(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.matching.candidatesForJob(user, id);
  }

  @Get('jobs/:id/sourcing-candidates')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Danh sách ứng viên iLink săn cho vị trí trong gói Săn' })
  sourcingCandidates(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.matching.candidatesForSourcing(user, id);
  }

  @Get('recommended-jobs')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'AI gợi ý việc làm phù hợp cho ứng viên (có giải thích)' })
  recommendedJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.matching.jobsForCandidate(user);
  }

  @Get('jobs/:id/fit')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Mức phù hợp của ứng viên với một tin — cùng engine gợi ý AI' })
  jobFit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.matching.jobFitForCandidate(user, id);
  }
}
