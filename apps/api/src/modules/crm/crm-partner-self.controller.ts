import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CrmPartnerSelfView,
  type CrmPartnerView,
  type RegisterCrmPartnerRequest,
} from '@industriallink/contracts';
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
@Controller('recruiter/partner')
export class CrmPartnerSelfController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  @ApiOperation({ summary: 'Mã giới thiệu của tài khoản đang đăng nhập. Null nếu chưa đăng ký.' })
  mine(@CurrentUser() user: AuthenticatedUser): Promise<CrmPartnerSelfView> {
    return this.crm.myPartner(user);
  }

  @Post()
  @ApiOperation({ summary: 'Nhà tuyển dụng tự đăng ký cộng tác viên. Mỗi tài khoản một mã.' })
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterCrmPartnerRequest,
  ): Promise<CrmPartnerView> {
    return this.crm.registerPartner(user, body);
  }
}
