import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  type CrmPartnerProfileView,
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
  type CrmQuoteFormView,
  type UpdateCrmQuoteFormRequest,
  type CrmStaffProfilePage,
  type CrmStaffProfileView,
  type UpdateCrmStaffProfileRequest,
  type CrmStaffAccountView,
  type CrmStaffDirectory,
  type CreateCrmStaffAccountRequest,
  type UpdateCrmStaffAccountRequest,
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
import { AdminUsersService } from '../cms/admin-users.service';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager)
@Controller('crm')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly staffAccounts: AdminUsersService,
  ) {}

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

  @Get('quote-form')
  @ApiOperation({ summary: 'Mẫu in trên mọi tờ báo giá. Không chứa giá.' })
  quoteForm(@CurrentUser() user: AuthenticatedUser): Promise<CrmQuoteFormView> {
    return this.crm.quoteForm(user);
  }

  @Patch('quote-form')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin sửa phần cố định của tờ. Không đổi báo giá đã lập.' })
  setQuoteForm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmQuoteFormRequest,
  ): Promise<CrmQuoteFormView> {
    return this.crm.setQuoteForm(user, body);
  }

  @Post('quote-form/logo')
  @Roles(UserRole.SuperAdmin)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'SuperAdmin tải logo in trên tờ báo giá.' })
  uploadQuoteFormLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CrmQuoteFormView> {
    return this.crm.uploadQuoteFormLogo(user, file);
  }

  @Get('quote-form/logo')
  @Header('Cache-Control', 'private, max-age=60')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @ApiOperation({ summary: 'Logo trên tờ báo giá.' })
  async quoteFormLogo(): Promise<StreamableFile> {
    const logo = await this.crm.quoteFormLogo();
    if (!logo) throw new NotFoundException('Chưa có logo tờ báo giá');
    return new StreamableFile(logo.buffer, { type: logo.mime, disposition: 'inline' });
  }

  @Get('staff-accounts')
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Bảng nhân sự. Cùng dữ liệu với Người dùng ở Admin. Nhân viên không xem.' })
  staffAccountsList(@CurrentUser() user: AuthenticatedUser): Promise<CrmStaffDirectory> {
    return this.staffAccounts.staffDirectory(user);
  }

  @Post('staff-accounts')
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Thêm nhân sự. Trưởng phòng chỉ thêm nhân viên kinh doanh.' })
  createStaffAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmStaffAccountRequest,
  ): Promise<CrmStaffAccountView> {
    return this.staffAccounts.createStaff(user, body);
  }

  @Patch('staff-accounts/:id')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin sửa tài khoản nhân sự. Admin dùng cùng bản ghi.' })
  updateStaffAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmStaffAccountRequest,
  ): Promise<CrmStaffAccountView> {
    return this.staffAccounts.updateStaff(user, id, body);
  }

  @Delete('staff-accounts/:id')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin xóa nhân sự. Tài khoản cũng mất ở Admin.' })
  deleteStaffAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.staffAccounts.deleteStaff(user, id);
  }

  @Get('staff-profile')
  @ApiOperation({ summary: 'Hồ sơ nhân sự. Nhân sự xem của mình. SuperAdmin chọn người.' })
  staffProfile(@CurrentUser() user: AuthenticatedUser, @Query('userId') userId = ''): Promise<CrmStaffProfilePage> {
    return this.crm.staffProfile(user, userId || undefined);
  }

  @Patch('staff-profile')
  @ApiOperation({ summary: 'Sửa hồ sơ của chính mình. SuperAdmin sửa hồ sơ nhân sự. Không đổi email đăng nhập.' })
  saveStaffProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmStaffProfileRequest,
  ): Promise<CrmStaffProfileView> {
    return this.crm.saveStaffProfile(user, body);
  }

  @Post('staff-profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Ảnh đại diện của chính mình. SuperAdmin tải cho nhân sự.' })
  uploadStaffAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId = '',
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CrmStaffProfileView> {
    return this.crm.uploadStaffAvatar(user, userId || undefined, file);
  }

  @Get('staff-profile/avatar')
  @Header('Cache-Control', 'private, max-age=60')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @ApiOperation({ summary: 'Ảnh đại diện nhân sự.' })
  async staffAvatar(@CurrentUser() user: AuthenticatedUser, @Query('userId') userId = ''): Promise<StreamableFile> {
    const avatar = await this.crm.staffAvatar(user, userId || undefined);
    if (!avatar) throw new NotFoundException('Chưa có ảnh đại diện');
    return new StreamableFile(avatar.buffer, { type: avatar.mime, disposition: 'inline' });
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
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Nhân sự kinh doanh đang hoạt động, để chuyển lead.' })
  owners(@CurrentUser() user: AuthenticatedUser): Promise<CrmOwnerOption[]> {
    return this.crm.owners(user);
  }

  @Delete('leads/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa tiềm năng của người phụ trách. SuperAdmin xóa được của mọi sale. Không xóa công ty và không hủy đơn đã trả.' })
  deleteLead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.crm.deleteLead(user, id).then(() => ({ ok: true as const }));
  }

  @Delete('deals/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa cơ hội của người phụ trách. SuperAdmin xóa được của mọi sale. Không hủy đơn đã trả.' })
  deleteDeal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.crm.deleteDeal(user, id).then(() => ({ ok: true as const }));
  }

  @Delete('quotes/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xóa báo giá của người phụ trách. Tờ đã ghi thu thì không xóa. Không hủy đơn đã trả.' })
  deleteQuote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ ok: true }> {
    return this.crm.deleteQuote(user, id).then(() => ({ ok: true as const }));
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
  @ApiOperation({ summary: 'SuperAdmin đặt thuế suất 0–100. Đơn mới cộng VAT theo mức này. Đơn đã tạo giữ mức cũ.' })
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
  @ApiOperation({ summary: 'Danh sách cộng tác viên, doanh số tháng và số chờ đối soát người xem được thấy.' })
  partners(@CurrentUser() user: AuthenticatedUser): Promise<CrmPartnerView[]> {
    return this.crm.partners(user);
  }

  @Get('partners/:id')
  @ApiOperation({ summary: 'Hồ sơ cộng tác viên. Doanh số tháng là tiền khách đã trả, chưa VAT.' })
  partner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('month') month = '',
  ): Promise<CrmPartnerProfileView> {
    return this.crm.partnerProfile(user, id, month);
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
