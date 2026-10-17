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
  type CrmCustomerView,
  type CrmTaxSuggestion,
  type CrmCompanyProfileView,
  type CrmUnclaimedCustomerView,
  type CrmOwnerOption,
  type UpdateCrmLeadRequest,
  type CrmDealView,
  type CrmLeadView,
  type CrmCommissionView,
  type CrmPayoutDayView,
  type CrmVatView,
  type UpdateCrmVatRequest,
  type UpdateCrmPayoutDayRequest,
  type CrmCommissionLedgerView,
  type CrmCommissionPeriodListView,
  type CrmCommissionPeriodView,
  type CloseCrmCommissionMonthRequest,
  type CloseCrmCommissionMonthResult,
  type CrmPartnerClaimView,
  type CrmPartnerView,
  type UpdateCrmCommissionRequest,
  type CrmPlanOption,
  type CrmRenewalView,
  type CrmFunnelReport,
  type CrmPipelineReport,
  type CrmLeadSourceReport,
  type CrmQuoteReport,
  type CrmRenewalReport,
  type CrmPartnerPaidReport,
  type CrmWorkspaceReport,
  type CreateCrmQuoteRequest,
  type CrmQuoteView,
  type CrmReceivableLedger,
  type CrmPaidInvoiceLedgerView,
  type CrmPaidOrderInvoiceView,
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

  @Get('workspace')
  @ApiOperation({ summary: 'Số bàn làm việc theo tháng. Công nợ là đợt Enterprise đã chốt, chưa thu.' })
  workspace(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmWorkspaceReport> {
    return this.crm.workspaceReport(user, month);
  }

  @Get('reports/funnel')
  @ApiOperation({ summary: 'Báo cáo lead và đơn đã trả theo sale, nguồn, cộng tác viên. Không đổi gói.' })
  funnelReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmFunnelReport> {
    return this.crm.funnelReport(user, month);
  }

  @Get('reports/pipeline')
  @ApiOperation({ summary: 'Phễu cơ hội và ngày kỳ vọng. Giá niêm yết, không phải doanh số.' })
  pipelineReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmPipelineReport> {
    return this.crm.pipelineReport(user, month);
  }

  @Get('reports/leads')
  @ApiOperation({ summary: 'Lead mới trong tháng theo nguồn và người phụ trách.' })
  leadSourceReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmLeadSourceReport> {
    return this.crm.leadSourceReport(user, month);
  }

  @Get('reports/quotes')
  @ApiOperation({ summary: 'Báo giá trong tháng. Hai phương án không cộng. Không tạo đơn.' })
  quoteReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmQuoteReport> {
    return this.crm.quoteReport(user, month);
  }

  @Get('reports/renewals')
  @ApiOperation({ summary: 'Gói hết hạn trong tháng và gói đã trả tiếp. Không bật gói.' })
  renewalReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmRenewalReport> {
    return this.crm.renewalReport(user, month);
  }

  @Get('reports/partners')
  @ApiOperation({ summary: 'Đơn đã trả gắn mã giới thiệu. Không hiện hoa hồng.' })
  partnerPaidReport(@CurrentUser() user: AuthenticatedUser, @Query('month') month = ''): Promise<CrmPartnerPaidReport> {
    return this.crm.partnerPaidReport(user, month);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'Danh sách báo giá. Không tạo đơn.' })
  quotes(@CurrentUser() user: AuthenticatedUser): Promise<CrmQuoteView[]> {
    return this.crm.quotes(user);
  }

  @Post('quotes')
  @ApiOperation({ summary: 'Lập báo giá gói niêm yết hoặc hợp đồng Enterprise. Không tạo đơn và không bật gói.' })
  createQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmQuoteRequest,
  ): Promise<CrmQuoteView> {
    return this.crm.createQuote(user, body);
  }

  @Get('quotes/:id')
  @ApiOperation({ summary: 'Một tờ báo giá. Giá chưa VAT.' })
  quote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CrmQuoteView> {
    return this.crm.quote(user, id);
  }

  @Post('quotes/:id/accept')
  @ApiOperation({ summary: 'Chốt hợp đồng Enterprise. Các đợt thành công nợ. Không bật gói.' })
  acceptQuote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CrmQuoteView> {
    return this.crm.acceptEnterpriseQuote(user, id);
  }

  @Post('quotes/:quoteId/installments/:installmentId/collect')
  @ApiOperation({ summary: 'Ghi một đợt Enterprise đã thu. Không bật gói.' })
  collectInstallment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
    @Param('installmentId') installmentId: string,
  ): Promise<CrmQuoteView> {
    return this.crm.collectInstallment(user, quoteId, installmentId);
  }

  @Get('receivables')
  @ApiOperation({ summary: 'Công nợ Enterprise đang mở. Không gồm tờ chưa chốt.' })
  receivables(@CurrentUser() user: AuthenticatedUser): Promise<CrmReceivableLedger> {
    return this.crm.receivables(user);
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Khách sắp hết gói. Không đổi gói và không tạo đơn.' })
  renewals(@CurrentUser() user: AuthenticatedUser): Promise<CrmRenewalView[]> {
    return this.crm.renewals(user);
  }

  @Get('tax-suggestions')
  @ApiOperation({ summary: 'Gợi ý tên công ty theo mã số thuế. Không tạo lead.' })
  taxSuggestions(@Query('q') q = ''): Promise<CrmTaxSuggestion[]> {
    return this.crm.taxSuggestions(q);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Sổ khách hàng. Sale chỉ thấy công ty mình phụ trách. Không gán gói.' })
  customers(@CurrentUser() user: AuthenticatedUser, @Query('q') q = ''): Promise<CrmCustomerView[]> {
    return this.crm.customers(user, q);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Tìm công ty đã có trên inlink để gắn lead' })
  companies(@Query('q') q = ''): Promise<CrmCompanyOption[]> {
    return this.crm.searchCompanies(q);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Hồ sơ một công ty: gói, credit, đơn đã trả, lead. Không gán gói.' })
  companyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CrmCompanyProfileView> {
    return this.crm.companyProfile(user, id);
  }

  @Get('unclaimed-customers')
  @ApiOperation({ summary: 'Công ty đã thanh toán gói và chưa có lead.' })
  unclaimedCustomers(): Promise<CrmUnclaimedCustomerView[]> {
    return this.crm.unclaimedCustomers();
  }

  @Post('companies/:id/claim')
  @ApiOperation({ summary: 'Nhận khách tự mua. Tạo lead cho người bấm. Không gán gói.' })
  claimCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CrmLeadView> {
    return this.crm.claimCustomer(user, id);
  }

  @Get('follow-ups')
  @ApiOperation({ summary: 'Lead đã hẹn gọi lại. Không đổi gói.' })
  followUps(@CurrentUser() user: AuthenticatedUser): Promise<CrmLeadView[]> {
    return this.crm.followUps(user);
  }

  @Get('owners')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Sale và SuperAdmin đang hoạt động, để chuyển lead.' })
  owners(@CurrentUser() user: AuthenticatedUser): Promise<CrmOwnerOption[]> {
    return this.crm.owners(user);
  }

  @Patch('leads/:id')
  @ApiOperation({ summary: 'Sửa lead. Chỉ SuperAdmin chuyển người phụ trách. Không gán gói.' })
  updateLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmLeadRequest,
  ): Promise<CrmLeadView> {
    return this.crm.updateLead(user, id, body);
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

  @Get('payout-day')
  @ApiOperation({ summary: 'Ngày trong tháng kế toán ghi đã chi. Không tự trừ ví.' })
  payoutDay(@CurrentUser() user: AuthenticatedUser): Promise<CrmPayoutDayView> {
    return this.crm.payoutDay(user);
  }

  @Patch('payout-day')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin đặt ngày chi từ 1 đến 28. Không chi tiền.' })
  setPayoutDay(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmPayoutDayRequest,
  ): Promise<CrmPayoutDayView> {
    return this.crm.setPayoutDay(user, body);
  }

  @Get('vat')
  @ApiOperation({ summary: 'Thuế suất đang đặt. Null khi chưa nhập. Không đổi giá.' })
  vat(@CurrentUser() user: AuthenticatedUser): Promise<CrmVatView> {
    return this.crm.vat(user);
  }

  @Patch('vat')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin đặt thuế suất 0–100. Không cộng vào đơn.' })
  setVat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmVatRequest,
  ): Promise<CrmVatView> {
    return this.crm.setVat(user, body);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Khoản hoa hồng chờ đối soát. Không chi và không rút.' })
  commissions(@CurrentUser() user: AuthenticatedUser): Promise<CrmCommissionLedgerView> {
    return this.crm.commissionLedger(user);
  }

  @Get('commission-periods')
  @ApiOperation({ summary: 'Kỳ hoa hồng đã chốt. Chưa duyệt chi và chưa vào ví.' })
  commissionPeriods(@CurrentUser() user: AuthenticatedUser): Promise<CrmCommissionPeriodListView> {
    return this.crm.commissionPeriods(user);
  }

  @Post('commission-periods')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Chốt hoa hồng của một tháng đã kết thúc. Không duyệt chi.' })
  closeCommissionMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CloseCrmCommissionMonthRequest,
  ): Promise<CloseCrmCommissionMonthResult> {
    return this.crm.closeCommissionMonth(user, body?.periodMonth ?? '');
  }

  @Post('commission-periods/:id/approve')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Cho phép chi một kỳ đã chốt và chuyển kế toán. Không trừ ví.' })
  allowCommissionPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CrmCommissionPeriodView> {
    return this.crm.allowCommissionPayout(user, id);
  }

  @Post('commission-periods/:id/pay')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Ghi đã chi một kỳ kế toán đang giữ và trừ ví inlink. Không chuyển khoản.' })
  markCommissionPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CrmCommissionPeriodView> {
    return this.crm.markCommissionPaid(user, id);
  }

  @Get('partners')
  @ApiOperation({ summary: 'Danh sách cộng tác viên và số chờ đối soát người xem được thấy.' })
  partners(@CurrentUser() user: AuthenticatedUser): Promise<CrmPartnerView[]> {
    return this.crm.partners(user);
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

  @Get('invoices')
  @ApiOperation({ summary: 'Đơn gói đã thanh toán và số hóa đơn đã xuất. Không tính VAT, không công nợ.' })
  invoices(@CurrentUser() user: AuthenticatedUser): Promise<CrmPaidInvoiceLedgerView> {
    return this.crm.paidInvoices(user);
  }

  @Patch('orders/:orderId/invoice')
  @ApiOperation({ summary: 'Ghi số hóa đơn cho đơn đã thanh toán. Không bật gói và không thu thêm.' })
  issueOrderInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() body: IssueCrmInvoiceRequest,
  ): Promise<CrmPaidOrderInvoiceView> {
    return this.crm.issueOrderInvoice(user, orderId, body);
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
