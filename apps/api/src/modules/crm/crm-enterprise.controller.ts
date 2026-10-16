import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole, type CrmEnterpriseRequestView } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin)
@Controller('recruiter/enterprise-requests')
export class CrmEnterpriseController {
  constructor(private readonly crm: CrmService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Nhà tuyển dụng yêu cầu tư vấn Enterprise. Tạo lead và deal, không bật gói.' })
  request(@CurrentUser() user: AuthenticatedUser): Promise<CrmEnterpriseRequestView> {
    return this.crm.requestEnterprise(user);
  }
}
