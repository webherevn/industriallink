import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  CreateCrmPartnerClaimRequest,
  CrmPartnerClaimView,
  CrmPartnerSelfView,
  CrmPartnerView,
  CtvCommissionPolicyPublicView,
  CtvMonthlyTierView,
  RegisterCrmPartnerRequest,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmService } from './crm.service';
import { CtvCommissionPolicyService } from './ctv-commission-policy.service';
import { vietnamPeriodMonth } from './commission-period';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['recruiter/partner', 'partner'])
export class CrmPartnerSelfController {
  constructor(
    private readonly crm: CrmService,
    private readonly commissionPolicy: CtvCommissionPolicyService,
  ) {}

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

  @Get('commission-tier')
  @ApiOperation({
    summary: 'Bậc hoa hồng tháng này + thanh tiến độ lên hạng. Chỉ CTV của chính mình.',
  })
  async myCommissionTier(
    @CurrentUser() user: AuthenticatedUser,
    @Query('yearMonth') yearMonth?: string,
  ): Promise<CtvMonthlyTierView> {
    const month = yearMonth ?? vietnamPeriodMonth(new Date());
    const partnerId = await this.partnerIdFor(user);
    if (!partnerId) {
      return {
        yearMonth: month,
        totalEligibleRevenueVnd: '0',
        achievedTierCode: null,
        achievedTierName: null,
        appliedRatePercent: null,
        nextTierCode: null,
        nextTierName: null,
        nextTierRatePercent: null,
        revenueToNextTierVnd: '0',
        nextTierThresholdVnd: null,
        estimatedCommissionVnd: '0',
      };
    }
    return this.commissionPolicy.monthlyTier(partnerId, month);
  }

  @Get('commission-policy')
  @ApiOperation({ summary: 'Chính sách hoa hồng đang áp dụng (read-only cho CTV).' })
  policy(): Promise<CtvCommissionPolicyPublicView | null> {
    return this.commissionPolicy.publicPolicy();
  }

  private async partnerIdFor(user: AuthenticatedUser): Promise<string | null> {
    const self = await this.crm.myPartner(user);
    return self.partner?.id ?? null;
  }
}
