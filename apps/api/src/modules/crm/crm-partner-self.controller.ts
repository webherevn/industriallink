import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  CreateCrmPartnerClaimRequest,
  CrmPartnerClaimView,
  CrmPartnerSelfView,
  CrmPartnerView,
  RegisterCrmPartnerRequest,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['recruiter/partner', 'partner'])
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

  @Post('claims')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cộng tác viên khóa mã số thuế nhà máy của mình.' })
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmPartnerClaimRequest,
  ): Promise<CrmPartnerClaimView> {
    return this.crm.addMyClaim(user, body);
  }
}
