import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/security/public.decorator';
import { PaymentService } from './payment.service';

@ApiTags('Billing Bank Webhook')
@Controller('billing/webhooks')
export class BillingBankWebhookController {
  constructor(private readonly payment: PaymentService) {}

  @Post('bank')
  @Public()
  @ApiOperation({
    summary: 'Webhook đối soát chuyển khoản ngân hàng tự động (hỗ trợ SePay & Casso)',
  })
  handleBankWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.payment.handleBankWebhook(headers, payload);
  }
}
