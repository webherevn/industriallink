import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import type {
  AdminCreatePlatformPlanRequest,
  AdminUpdatePlatformPlanRequest,
  AdminCreateSourcingPlanRequest,
  AdminUpdateSourcingPlanRequest,
  AdminCreateCreditTopupRequest,
  AdminUpdateCreditTopupRequest,
  AdminUpdateCreditPolicyRequest,
  AdminUpdateCurrencyConfigRequest,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  BillingCreditTopupView,
  BillingCreditPolicyView,
  BillingCurrencyDisplay,
  BillingAuditListResponse,
  BillingCreditLedgerListResponse,
  BillingCreditSummary,
  BillingCreditAccountView,
  AdminCreditAdjustRequest,
  BillingPaymentSettingView,
  UpdatePaymentSettingsRequest,
  AdminUpdatePlanActionCostsRequest,
  AdminAssignCompanyPlanRequest,
  AdminAssignCompanySourcingPlanRequest,
  BillingPlanActionCostView,
  BillingCompanyPlanView,
  BillingCompanySourcingPlanView,
  AdminUpdatePageContentRequest,
  BillingPageContentView,
} from '@industriallink/contracts';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import { PaymentService } from './payment.service';
import { SourcingService } from './sourcing.service';

@ApiTags('Admin Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/billing')
export class BillingAdminController {
  constructor(
    private readonly billing: BillingService,
    private readonly credit: CreditService,
    private readonly payment: PaymentService,
    private readonly sourcing: SourcingService,
  ) {}

  // =========================================================================
  // PLATFORM PLANS
  // =========================================================================
  @Get('platform-plans')
  @ApiOperation({ summary: 'Danh sách gói nền tảng (Tầng 1)' })
  listPlatformPlans(@Query('includeInactive') includeInactive?: string): Promise<BillingPlatformPlanView[]> {
    return this.billing.listPlatformPlans(includeInactive === 'true');
  }

  @Post('platform-plans')
  @ApiOperation({ summary: 'Tạo gói nền tảng mới' })
  createPlatformPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreatePlatformPlanRequest
  ): Promise<BillingPlatformPlanView> {
    return this.billing.createPlatformPlan(user, dto);
  }

  @Patch('platform-plans/:id')
  @ApiOperation({ summary: 'Sửa gói nền tảng' })
  updatePlatformPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdatePlatformPlanRequest
  ): Promise<BillingPlatformPlanView> {
    return this.billing.updatePlatformPlan(user, id, dto);
  }

  @Delete('platform-plans/:id')
  @ApiOperation({ summary: 'Tắt gói nền tảng (soft delete)' })
  async deletePlatformPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ ok: true }> {
    await this.billing.deletePlatformPlan(user, id);
    return { ok: true };
  }

  @Get('platform-plans/:id/costs')
  @ApiOperation({ summary: 'Cost-per-action của 1 gói nền tảng' })
  getPlanActionCosts(@Param('id') id: string): Promise<BillingPlanActionCostView[]> {
    return this.billing.getPlanActionCosts(id);
  }

  @Patch('platform-plans/:id/costs')
  @ApiOperation({ summary: 'Cập nhật cost-per-action của 1 gói nền tảng' })
  updatePlanActionCosts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdatePlanActionCostsRequest,
  ): Promise<BillingPlanActionCostView[]> {
    return this.billing.updatePlanActionCosts(user, id, dto);
  }

  @Get('company-plans/:companyId')
  @ApiOperation({ summary: 'Gói nền tảng đang gán cho công ty' })
  getCompanyPlan(@Param('companyId') companyId: string): Promise<BillingCompanyPlanView | null> {
    return this.billing.getCompanyPlan(companyId);
  }

  @Put('company-plans')
  @ApiOperation({ summary: 'Gán / đổi gói nền tảng cho công ty' })
  assignCompanyPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminAssignCompanyPlanRequest,
  ): Promise<BillingCompanyPlanView> {
    return this.billing.assignCompanyPlan(user, dto);
  }

  @Delete('company-plans/:companyId')
  @ApiOperation({ summary: 'Gỡ gói nền tảng khỏi công ty (fallback policy global)' })
  async unassignCompanyPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ): Promise<{ ok: true }> {
    await this.billing.unassignCompanyPlan(user, companyId);
    return { ok: true };
  }

  @Get('company-sourcing-plans/:companyId')
  @ApiOperation({ summary: 'Gói Săn đang gán cho công ty' })
  getCompanySourcingPlan(
    @Param('companyId') companyId: string,
  ): Promise<BillingCompanySourcingPlanView | null> {
    return this.sourcing.getCompanyAssignment(companyId);
  }

  @Put('company-sourcing-plans')
  @ApiOperation({ summary: 'Gán / đổi gói Săn cho công ty' })
  assignCompanySourcingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminAssignCompanySourcingPlanRequest,
  ): Promise<BillingCompanySourcingPlanView> {
    return this.sourcing.assignCompanyPlan(user, dto);
  }

  @Delete('company-sourcing-plans/:companyId')
  @ApiOperation({ summary: 'Gỡ gói Săn khỏi công ty' })
  async unassignCompanySourcingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId') companyId: string,
  ): Promise<{ ok: true }> {
    await this.sourcing.unassignCompanyPlan(user, companyId);
    return { ok: true };
  }

  // =========================================================================
  // SOURCING PLANS
  // =========================================================================
  @Get('sourcing-plans')
  @ApiOperation({ summary: 'Danh sách gói Săn nhân sự (Tầng 2)' })
  listSourcingPlans(@Query('includeInactive') includeInactive?: string): Promise<BillingSourcingPlanView[]> {
    return this.billing.listSourcingPlans(includeInactive === 'true');
  }

  @Post('sourcing-plans')
  @ApiOperation({ summary: 'Tạo gói Săn mới' })
  createSourcingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreateSourcingPlanRequest
  ): Promise<BillingSourcingPlanView> {
    return this.billing.createSourcingPlan(user, dto);
  }

  @Patch('sourcing-plans/:id')
  @ApiOperation({ summary: 'Sửa gói Săn' })
  updateSourcingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateSourcingPlanRequest
  ): Promise<BillingSourcingPlanView> {
    return this.billing.updateSourcingPlan(user, id, dto);
  }

  @Delete('sourcing-plans/:id')
  @ApiOperation({ summary: 'Tắt gói Săn (soft delete)' })
  async deleteSourcingPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ ok: true }> {
    await this.billing.deleteSourcingPlan(user, id);
    return { ok: true };
  }

  // =========================================================================
  // CREDIT TOP-UP
  // =========================================================================
  @Get('credit-topups')
  @ApiOperation({ summary: 'Danh sách gói top-up Credit' })
  listCreditTopups(@Query('includeInactive') includeInactive?: string): Promise<BillingCreditTopupView[]> {
    return this.billing.listCreditTopups(includeInactive === 'true');
  }

  @Post('credit-topups')
  @ApiOperation({ summary: 'Tạo gói top-up Credit' })
  createCreditTopup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreateCreditTopupRequest
  ): Promise<BillingCreditTopupView> {
    return this.billing.createCreditTopup(user, dto);
  }

  @Patch('credit-topups/:id')
  @ApiOperation({ summary: 'Sửa gói top-up' })
  updateCreditTopup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateCreditTopupRequest
  ): Promise<BillingCreditTopupView> {
    return this.billing.updateCreditTopup(user, id, dto);
  }

  @Delete('credit-topups/:id')
  @ApiOperation({ summary: 'Tắt gói top-up (soft delete)' })
  async deleteCreditTopup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ ok: true }> {
    await this.billing.deleteCreditTopup(user, id);
    return { ok: true };
  }

  // =========================================================================
  // CREDIT POLICY
  // =========================================================================
  @Get('credit-policy')
  @ApiOperation({ summary: 'Xem quy tắc trừ Credit' })
  getCreditPolicy(): Promise<BillingCreditPolicyView> {
    return this.billing.getCreditPolicy();
  }

  @Patch('credit-policy')
  @ApiOperation({ summary: 'Sửa quy tắc trừ Credit' })
  updateCreditPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminUpdateCreditPolicyRequest
  ): Promise<BillingCreditPolicyView> {
    return this.billing.updateCreditPolicy(user, dto);
  }

  // =========================================================================
  // CURRENCY CONFIG
  // =========================================================================
  @Get('currency')
  @ApiOperation({ summary: 'Xem cấu hình tiền tệ hiển thị' })
  getCurrency(): Promise<BillingCurrencyDisplay> {
    return this.billing.getCurrencyConfig();
  }

  @Patch('currency')
  @ApiOperation({ summary: 'Sửa cấu hình tiền tệ' })
  updateCurrency(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminUpdateCurrencyConfigRequest
  ): Promise<BillingCurrencyDisplay> {
    return this.billing.updateCurrencyConfig(user, dto);
  }

  // =========================================================================
  // PAGE CONTENT (/bang-gia)
  // =========================================================================
  @Get('page-content')
  @ApiOperation({ summary: 'Nội dung / SEO trang bảng giá' })
  getPageContent(): Promise<BillingPageContentView> {
    return this.billing.getPageContent();
  }

  @Patch('page-content')
  @ApiOperation({ summary: 'Cập nhật nội dung / SEO trang bảng giá' })
  updatePageContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminUpdatePageContentRequest,
  ): Promise<BillingPageContentView> {
    return this.billing.updatePageContent(user, dto);
  }

  // =========================================================================
  // AUDIT LOG
  // =========================================================================
  @Get('audit-log')
  @ApiOperation({ summary: 'Lịch sử thay đổi cấu hình billing' })
  listAuditLog(
    @Query('entity') entity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<BillingAuditListResponse> {
    return this.billing.listAuditLogs({
      entity,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // =========================================================================
  // CREDIT LEDGER (Admin)
  // =========================================================================
  @Get('credit-ledger')
  @ApiOperation({ summary: 'Nhật ký Credit — tất cả công ty' })
  listCreditLedger(
    @Query('companyId') companyId?: string,
    @Query('type') type?: string,
    @Query('action') action?: string,
    @Query('candidateId') candidateId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<BillingCreditLedgerListResponse> {
    return this.credit.listAll({
      companyId,
      type,
      action,
      candidateId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('credit-ledger/summary')
  @ApiOperation({ summary: 'Tổng quan Credit — dashboard admin' })
  getCreditSummary(): Promise<BillingCreditSummary> {
    return this.credit.summary();
  }

  @Get('credit-ledger/accounts')
  @ApiOperation({ summary: 'Danh sách tài khoản Credit' })
  listCreditAccounts(
    @Query('companyId') companyId?: string,
  ): Promise<{ items: BillingCreditAccountView[]; total: number }> {
    return this.credit.listAccounts({ companyId });
  }

  @Post('credit-ledger/adjust')
  @ApiOperation({ summary: 'Admin điều chỉnh credit thủ công' })
  async adminAdjustCredit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminCreditAdjustRequest,
  ): Promise<{ ok: boolean; message: string }> {
    const tx = await this.credit.adminAdjust(
      user.id,
      user.email ?? '',
      dto.companyId,
      user.tenantId,
      dto.creditDelta,
      dto.reason,
    );
    const sign = tx.creditDelta > 0 ? '+' : '';
    return {
      ok: true,
      message: `Đã điều chỉnh ${sign}${tx.creditDelta} credit cho tài khoản (số dư: ${tx.balanceAfter}).`,
    };
  }

  // =========================================================================
  // PAYMENT SETTINGS (Bước 7)
  // =========================================================================
  @Get('payment-settings')
  @ApiOperation({ summary: 'Xem cấu hình thanh toán Stripe (masked keys)' })
  async getPaymentSettings(): Promise<BillingPaymentSettingView> {
    return this.payment.getSettingsView();
  }

  @Patch('payment-settings')
  @ApiOperation({ summary: 'Cập nhật cấu hình thanh toán Stripe (admin)' })
  async updatePaymentSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePaymentSettingsRequest,
  ): Promise<BillingPaymentSettingView> {
    return this.payment.updateSettings(dto, user.id);
  }
}
