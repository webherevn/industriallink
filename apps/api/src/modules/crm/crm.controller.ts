import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CreateCrmActivityRequest,
  type CreateCrmDealRequest,
  type CreateCrmLeadRequest,
  type CreateCrmPartnerClaimRequest,
  type CreateCrmPartnerRequest,
  type CrmActivityView,
  type CrmBoard,
  type CrmCompanyOption,
  type CrmDealView,
  type CrmLeadView,
  type CrmCommissionView,
  type CrmCommissionLedgerView,
  type CrmPartnerClaimView,
  type CrmPartnerView,
  type UpdateCrmCommissionRequest,
  type CrmPlanOption,
  type CrmRenewalView,
  type IssueCrmInvoiceRequest,
  type MoveCrmDealRequest,
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
@Roles(UserRole.SuperAdmin, UserRole.Sales)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('board')
  @ApiOperation({ summary: 'Phễu bán gói và danh sách lead' })
  board(@CurrentUser() user: AuthenticatedUser): Promise<CrmBoard> {
    return this.crm.board(user);
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Khách sắp hết gói. Không đổi gói và không tạo đơn.' })
  renewals(@CurrentUser() user: AuthenticatedUser): Promise<CrmRenewalView[]> {
    return this.crm.renewals(user);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Tìm công ty đã có trên inlink để gắn lead' })
  companies(@Query('q') q = ''): Promise<CrmCompanyOption[]> {
    return this.crm.searchCompanies(q);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Gói tin và gói Săn đang bán. Không gồm Enterprise.' })
  plans(): Promise<CrmPlanOption[]> {
    return this.crm.plans();
  }

  @Get('commission')
  @ApiOperation({ summary: 'Tỷ lệ hoa hồng hiện tại. Chưa tạo số tiền phải chi.' })
  commission(@CurrentUser() user: AuthenticatedUser): Promise<CrmCommissionView> {
    return this.crm.commission(user);
  }

  @Patch('commission')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin đặt tỷ lệ hoa hồng 0–30%. Không chi tiền.' })
  setCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmCommissionRequest,
  ): Promise<CrmCommissionView> {
    return this.crm.setCommission(user, body);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Khoản hoa hồng chờ đối soát. Không chi và không rút.' })
  commissions(@CurrentUser() user: AuthenticatedUser): Promise<CrmCommissionLedgerView> {
    return this.crm.commissionLedger(user);
  }

  @Get('partners')
  @ApiOperation({ summary: 'Danh sách cộng tác viên. Chưa tính hoa hồng.' })
  partners(): Promise<CrmPartnerView[]> {
    return this.crm.partners();
  }

  @Post('partners')
  @ApiOperation({ summary: 'Tạo cộng tác viên và mã giới thiệu. Không khóa lead theo mã số thuế.' })
  createPartner(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmPartnerRequest,
  ): Promise<CrmPartnerView> {
    return this.crm.createPartner(user, body);
  }

  @Post('partners/:id/claims')
  @ApiOperation({ summary: 'Khóa mã số thuế cho cộng tác viên. Không gán gói.' })
  addClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateCrmPartnerClaimRequest,
  ): Promise<CrmPartnerClaimView> {
    return this.crm.addPartnerClaim(user, id, body);
  }

  @Post('leads')
  @ApiOperation({ summary: 'Tạo lead. Không tạo công ty và không gán gói.' })
  createLead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmLeadRequest,
  ): Promise<CrmLeadView> {
    return this.crm.createLead(user, body);
  }

  @Post('deals')
  @ApiOperation({ summary: 'Tạo deal gắn SKU hiện có. Không kích hoạt gói.' })
  createDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmDealRequest,
  ): Promise<CrmDealView> {
    return this.crm.createDeal(user, body);
  }

  @Post('activities')
  @ApiOperation({ summary: 'Ghi nhật ký chăm sóc cho lead hoặc deal' })
  createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmActivityRequest,
  ): Promise<CrmActivityView> {
    return this.crm.createActivity(user, body);
  }

  @Patch('deals/:id/invoice')
  @ApiOperation({ summary: 'Ghi số hóa đơn đã xuất. Không tính VAT, không theo dõi công nợ, không gán gói.' })
  issueInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: IssueCrmInvoiceRequest,
  ): Promise<CrmDealView> {
    return this.crm.issueInvoice(user, id, body);
  }

  @Patch('deals/:id/stage')
  @ApiOperation({ summary: 'Đổi bước phễu. Không tạo đơn và không gán gói.' })
  moveDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MoveCrmDealRequest,
  ): Promise<CrmDealView> {
    return this.crm.moveDeal(user, id, body);
  }
}
