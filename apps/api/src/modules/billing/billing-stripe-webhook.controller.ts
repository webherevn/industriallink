import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { verifyStripeSignature } from './payment-webhook-signature.util';
import { decryptSecret } from '../ai/ai-settings.cipher';
import type { AppConfig } from '../../config/configuration';

/**
 * Stripe webhook handler.
 * Endpoint: POST /api/v1/billing/payment/stripe/webhook
 * - Verify chữ ký Stripe bằng webhook secret
 * - Parse event JSON
 * - Gọi PaymentService.handleStripeEvent (idempotent theo event ID)
 *
 * QUAN TRỌNG: phải nhận RAW body để verify signature. NestJS mặc định parse JSON
 * nên ta dùng Req() để đọc lại rawBytes.
 */
@ApiTags('Billing Webhook')
@Controller('billing/payment/stripe')
export class BillingStripeWebhookController {
  constructor(
    private readonly payment: PaymentService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook (verify signature + xử lý event)' })
  async webhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() req: { rawBody?: Buffer; body?: unknown },
  ): Promise<{ ok: boolean; message: string }> {
    const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? (req.body as Buffer) : undefined);
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Webhook cần raw body để verify signature');
    }

    // Lấy webhook secret từ DB (encrypted). Nếu chưa cấu hình → từ chối.
    const settings = await this.payment['prisma'].billingPaymentSetting.findUnique({
      where: { scope: 'default' },
    });
    if (!settings?.stripeWebhookSecretEnc) {
      throw new BadRequestException('Webhook secret chưa được cấu hình');
    }
    const ai = this.config.get('ai', { infer: true });
    const encryptionKey = ai.settingsEncryptionKey || this.config.get('jwt', { infer: true }).accessSecret;
    let secret: string;
    try {
      secret = decryptSecret(settings.stripeWebhookSecretEnc, encryptionKey);
    } catch {
      throw new BadRequestException('Webhook secret không giải mã được');
    }

    if (!verifyStripeSignature(rawBody, signature, secret)) {
      throw new BadRequestException('Chữ ký Stripe không hợp lệ');
    }

    let event: { id: string; type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Body không phải JSON hợp lệ');
    }
    if (!event?.id || !event?.type) {
      throw new BadRequestException('Event thiếu id hoặc type');
    }

    return this.payment.handleStripeEvent(event);
  }
}
