import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type BillingCompanyPlanView,
  type RecruiterCreateCheckoutRequest,
  type RecruiterCreatePlanCheckoutRequest,
  type RecruiterCreateSourcingCheckoutRequest,
  type BillingCompanySourcingPlanView,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import type { PaymentCheckoutResponse, RecruiterOrderListResponse } from '@industriallink/contracts';
import { CompanyService } from '../company/company.service';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { SourcingService } from './sourcing.service';

@ApiTags('Billing Payment (Recruiter)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
@Controller('billing')
export class BillingRecruiterPaymentController {
  constructor(
    private readonly payment: PaymentService,
    private readonly billing: BillingService,
    private readonly sourcing: SourcingService,
    private readonly companies: CompanyService,
  ) {}

  @Post('topup/checkout')
  @ApiOperation({ summary: 'Tạo đơn mua Top-up Credit (mock hoặc Stripe)' })
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecruiterCreateCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.payment.createCheckout(user, companyId, dto.topupId, webOrigin);
  }

  @Post('plan/checkout')
  @ApiOperation({ summary: 'Tạo đơn mua gói tin. Gán gói khi thanh toán thành công.' })
  async checkoutPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecruiterCreatePlanCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.payment.createCatalogCheckout(user, companyId, 'platform', dto.planCode, webOrigin);
  }

  @Post('sourcing/checkout')
  @ApiOperation({ summary: 'Tạo đơn mua gói Săn. Gán gói khi thanh toán thành công.' })
  async checkoutSourcing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecruiterCreateSourcingCheckoutRequest,
  ): Promise<PaymentCheckoutResponse> {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.payment.createCatalogCheckout(user, companyId, 'sourcing', dto.planCode, webOrigin);
  }

  @Post('plan/activate')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin kích hoạt gói nền tảng không qua đơn thanh toán' })
  async activatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecruiterCreatePlanCheckoutRequest,
  ): Promise<BillingCompanyPlanView> {
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.billing.activatePurchasedPlan(user, companyId, dto.planCode);
  }

  @Post('sourcing/activate')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'SuperAdmin kích hoạt gói Săn không qua đơn thanh toán' })
  async activateSourcing(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecruiterCreateSourcingCheckoutRequest,
  ): Promise<BillingCompanySourcingPlanView> {
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.sourcing.activatePurchasedPlan(user, companyId, dto.planCode);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Lịch sử đơn mua Top-up của công ty' })
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecruiterOrderListResponse> {
    const { companyId } = await this.companies.requireOrProvisionCompany(user);
    return this.payment.listOrdersForCompany(companyId);
  }
}
