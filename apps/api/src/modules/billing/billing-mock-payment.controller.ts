import { BadRequestException, Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type BillingOrderView } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import { PaymentService } from './payment.service';

/**
 * Endpoint giả lập thanh toán cho Mock mode.
 * CHỈ khả dụng khi billing.billing_payment_setting.mode = 'mock'.
 * Khi chuyển sang 'live' (Stripe thật) các endpoint này vẫn tồn tại nhưng
 * UI sẽ ẩn + service có thể từ chối.
 */
@ApiTags('Billing Payment Mock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Recruiter, UserRole.CompanyAdmin, UserRole.SuperAdmin)
@Controller('billing/topup/mock')
export class BillingMockPaymentController {
  constructor(
    private readonly payment: PaymentService,
    private readonly companies: CompanyService,
  ) {}

  @Post(':orderId/success')
  @ApiOperation({ summary: '[Mock] Đánh dấu đơn đã thanh toán thành công + cấp credit' })
  async mockSuccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ): Promise<BillingOrderView> {
    // Đảm bảo user chỉ success order của chính công ty mình
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const order = await this.payment.getOrder(orderId).catch(() => null);
    if (order && order.companyId !== companyId) {
      throw new BadRequestException('Order không thuộc công ty của bạn');
    }
    return this.payment.handleMockSuccess(orderId);
  }

  @Post(':orderId/fail')
  @ApiOperation({ summary: '[Mock] Đánh dấu đơn thanh toán thất bại' })
  async mockFail(
    @Param('orderId') orderId: string,
    @Body() body: { reason?: string },
  ): Promise<BillingOrderView> {
    return this.payment.handleMockFailure(orderId, body?.reason || 'User cancelled');
  }
}
