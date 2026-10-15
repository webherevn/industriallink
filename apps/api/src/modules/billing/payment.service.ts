import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BillingOrderView,
  BillingPaymentSettingView,
  PaymentCheckoutResponse,
  PaymentMode,
  RecruiterOrderListResponse,
  UpdatePaymentSettingsRequest,
} from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { decryptSecret, encryptSecret, keyPreview } from '../ai/ai-settings.cipher';
import { CreditService } from './credit.service';

const SCOPE = 'default';
type Row = Prisma.BillingPaymentSettingGetPayload<Record<string, never>>;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly credit: CreditService,
  ) {}

  private encryptionSecret(): string {
    const ai = this.config.get('ai', { infer: true });
    if (ai.settingsEncryptionKey) return ai.settingsEncryptionKey;
    return this.config.get('jwt', { infer: true }).accessSecret;
  }

  private async row(): Promise<Row | null> {
    return this.prisma.billingPaymentSetting.findUnique({ where: { scope: SCOPE } });
  }

  private decrypt(enc: string | null | undefined): string | undefined {
    if (!enc) return undefined;
    try {
      return decryptSecret(enc, this.encryptionSecret());
    } catch (err) {
      this.logger.error(`Giải mã payment key thất bại: ${String(err)}`);
      return undefined;
    }
  }

  // =====================================================================
  // SETTINGS (Admin)
  // =====================================================================

  async getSettingsView(): Promise<BillingPaymentSettingView> {
    const row = await this.row();
    const pk = this.decrypt(row?.stripePublishableKeyEnc);
    const sk = this.decrypt(row?.stripeSecretKeyEnc);
    const wh = this.decrypt(row?.stripeWebhookSecretEnc);
    const updatedByEmail = row?.updatedBy
      ? (
          await this.prisma.user.findUnique({
            where: { id: row.updatedBy },
            select: { email: true },
          })
        )?.email ?? null
      : null;
    return {
      mode: (row?.mode as PaymentMode) ?? 'mock',
      hasSecretKey: Boolean(sk),
      hasWebhookSecret: Boolean(wh),
      publishableKeyPreview: keyPreview(pk),
      secretKeyPreview: keyPreview(sk),
      webhookSecretPreview: keyPreview(wh),
      successUrl: row?.successUrl ?? '',
      cancelUrl: row?.cancelUrl ?? '',
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      updatedByEmail,
    };
  }

  async updateSettings(
    dto: UpdatePaymentSettingsRequest,
    adminId: string,
  ): Promise<BillingPaymentSettingView> {
    if (dto.mode && !['mock', 'live'].includes(dto.mode)) {
      throw new BadRequestException('mode chỉ nhận "mock" hoặc "live"');
    }
    const secret = this.encryptionSecret();
    const keyUpdate = (
      value: string | null | undefined,
    ): string | null | undefined => {
      if (value === null) return null;
      if (typeof value === 'string' && value.trim() !== '') {
        return encryptSecret(value.trim(), secret);
      }
      return undefined;
    };

    const data: Prisma.BillingPaymentSettingUncheckedUpdateInput = {
      updatedBy: adminId,
    };
    if (dto.mode !== undefined) data.mode = dto.mode;
    if (dto.successUrl !== undefined) data.successUrl = dto.successUrl.trim();
    if (dto.cancelUrl !== undefined) data.cancelUrl = dto.cancelUrl.trim();
    const pkEnc = keyUpdate(dto.stripePublishableKey);
    if (pkEnc !== undefined) data.stripePublishableKeyEnc = pkEnc;
    const skEnc = keyUpdate(dto.stripeSecretKey);
    if (skEnc !== undefined) data.stripeSecretKeyEnc = skEnc;
    const whEnc = keyUpdate(dto.stripeWebhookSecret);
    if (whEnc !== undefined) data.stripeWebhookSecretEnc = whEnc;

    await this.prisma.billingPaymentSetting.upsert({
      where: { scope: SCOPE },
      create: { scope: SCOPE, ...(data as Prisma.BillingPaymentSettingUncheckedCreateInput) },
      update: data,
    });

    return this.getSettingsView();
  }

  // =====================================================================
  // CHECKOUT (Recruiter)
  // =====================================================================

  /**
   * Tạo đơn + (mock URL hoặc Stripe Checkout session).
   * - mock: trả URL trong app, không cần Stripe key.
   * - live: gọi Stripe API thật (yêu cầu secret key đã cấu hình).
   */
  async createCheckout(
    user: AuthenticatedUser,
    companyId: string,
    topupId: string,
    webOrigin: string,
  ): Promise<PaymentCheckoutResponse> {
    const topup = await this.prisma.billingCreditTopup.findUnique({ where: { id: topupId } });
    if (!topup || !topup.isActive) {
      throw new NotFoundException('Gói Top-up không tồn tại hoặc đã tắt');
    }
    const settings = await this.row();
    const mode = (settings?.mode as PaymentMode) ?? 'mock';
    const successUrlTemplate = settings?.successUrl ?? '/recruiter/billing/topup/success?session={CHECKOUT_SESSION_ID}';
    const cancelUrl = settings?.cancelUrl ?? '/recruiter/billing/topup/cancel';

    if (mode === 'live') {
      // Gọi Stripe API thật (yêu cầu node 18+ có global fetch).
      const secretKey = this.decrypt(settings?.stripeSecretKeyEnc);
      if (!secretKey) {
        throw new BadRequestException(
          'Chưa cấu hình Stripe Secret Key. Vào /admin/billing/payment để thêm hoặc chuyển sang Mock.',
        );
      }
      const sessionId = `cs_test_${randomBytes(16).toString('hex')}`;
      const successUrl = successUrlTemplate.replace(
        '{CHECKOUT_SESSION_ID}',
        sessionId,
      );
      const cancelFull = new URL(cancelUrl, webOrigin).toString();
      const successFull = new URL(successUrl, webOrigin).toString();
      const order = await this.createOrder({
        user,
        companyId,
        topupId: topup.id,
        creditCount: topup.creditCount,
        priceVnd: topup.priceVnd,
        provider: 'stripe',
        sessionId,
      });
      // Gọi Stripe API thật
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', successFull);
      form.set('cancel_url', cancelFull);
      form.set('client_reference_id', order.id);
      form.set('line_items[0][price_data][currency]', 'vnd');
      form.set('line_items[0][price_data][product_data][name]', topup.name);
      form.set('line_items[0][price_data][unit_amount]', String(Number(topup.priceVnd)));
      form.set('line_items[0][quantity]', '1');
      form.set('metadata[orderId]', order.id);
      form.set('metadata[companyId]', companyId);
      form.set('metadata[creditCount]', String(topup.creditCount));
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Stripe create session failed: ${res.status} ${errText}`);
        // Đánh fail order
        await this.prisma.billingOrder.update({
          where: { id: order.id },
          data: { status: 'failed', failedAt: new Date(), note: `Stripe API ${res.status}` },
        });
        throw new BadRequestException('Stripe từ chối tạo session. Kiểm tra Secret Key.');
      }
      const data = (await res.json()) as { id: string; url: string };
      // Cập nhật session id thật từ Stripe
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: { providerSessionId: data.id },
      });
      return { orderId: order.id, sessionId: data.id, url: data.url, mode: 'live' };
    }

    // ====== MOCK MODE ======
    const sessionId = `cs_mock_${randomBytes(12).toString('hex')}`;
    const order = await this.createOrder({
      user,
      companyId,
      topupId: topup.id,
      creditCount: topup.creditCount,
      priceVnd: topup.priceVnd,
      provider: 'stripe-mock',
      sessionId,
    });
    // URL trong app để test
    const url = new URL(
      `/recruiter/billing/topup/mock-checkout?session=${sessionId}&order=${order.id}`,
      webOrigin,
    ).toString();
    return { orderId: order.id, sessionId, url, mode: 'mock' };
  }

  private async createOrder(args: {
    user: AuthenticatedUser;
    companyId: string;
    topupId: string;
    creditCount: number;
    priceVnd: bigint;
    provider: 'stripe' | 'stripe-mock';
    sessionId: string;
  }) {
    return this.prisma.billingOrder.create({
      data: {
        tenantId: args.user.tenantId,
        companyId: args.companyId,
        topupId: args.topupId,
        creditCountSnapshot: args.creditCount,
        priceVndSnapshot: args.priceVnd,
        status: 'pending',
        provider: args.provider,
        providerSessionId: args.sessionId,
        createdByUserId: args.user.id,
        createdByEmail: args.user.email ?? null,
      },
    });
  }

  // =====================================================================
  // WEBHOOK HANDLERS
  // =====================================================================

  /** Xử lý khi user bấm "Thanh toán thành công" trên mock page. */
  async handleMockSuccess(orderId: string): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order không tồn tại');
    if (order.status !== 'pending') {
      throw new BadRequestException(`Order đã ở trạng thái ${order.status}, không thể thay đổi.`);
    }
    return this.markPaidAndGrant(order, 'evt_mock_success_' + randomBytes(8).toString('hex'), {
      mock: true,
      outcome: 'success',
    });
  }

  /** Xử lý khi user bấm "Thanh toán thất bại" trên mock page. */
  async handleMockFailure(orderId: string, reason: string): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order không tồn tại');
    if (order.status !== 'pending') {
      throw new BadRequestException(`Order đã ở trạng thái ${order.status}.`);
    }
    await this.prisma.billingPayment.create({
      data: {
        orderId: order.id,
        providerEventId: 'evt_mock_fail_' + randomBytes(8).toString('hex'),
        eventType: 'mock.payment_failed',
        status: 'processed',
        amountVnd: order.priceVndSnapshot,
        rawPayload: { mock: true, outcome: 'failure', reason },
      },
    });
    return this.mapOrder(
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: { status: 'failed', failedAt: new Date(), note: reason },
      }),
    );
  }

  /**
   * Xử lý Stripe webhook event thật. Verify chữ ký đã làm ở controller,
   * ở đây chỉ parse + xử lý idempotent.
   */
  async handleStripeEvent(event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<{ ok: boolean; message: string }> {
    // Idempotent: nếu đã xử lý eventId này rồi thì skip
    const existing = await this.prisma.billingPayment.findUnique({
      where: { providerEventId: event.id },
    });
    if (existing) {
      return { ok: true, message: `Event ${event.id} đã xử lý trước đó (${existing.status})` };
    }

    if (event.type === 'checkout.session.completed') {
      const sessionObj = event.data.object as {
        id: string;
        payment_intent?: string;
        amount_total?: number;
        currency?: string;
        metadata?: Record<string, string>;
      };
      const orderId = sessionObj.metadata?.orderId;
      if (!orderId) {
        await this.prisma.billingPayment.create({
          data: {
            orderId: '00000000-0000-0000-0000-000000000000',
            providerEventId: event.id,
            eventType: event.type,
            status: 'ignored',
            rawPayload: event.data.object as unknown as Prisma.InputJsonValue,
            errorMessage: 'Thiếu metadata.orderId trong session',
          },
        });
        return { ok: false, message: 'Session không chứa orderId' };
      }
      const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
      if (!order) {
        return { ok: false, message: `Order ${orderId} không tồn tại` };
      }
      // Ghi log payment
      await this.prisma.billingPayment.create({
        data: {
          orderId: order.id,
          providerEventId: event.id,
          eventType: event.type,
          status: 'processed',
          amountVnd: BigInt(sessionObj.amount_total ?? Number(order.priceVndSnapshot)),
          rawPayload: event.data.object as unknown as Prisma.InputJsonValue,
        },
      });
      await this.markPaidAndGrant(order, event.id, {
        mock: false,
        paymentIntent: sessionObj.payment_intent ?? null,
      });
      return { ok: true, message: 'Order marked paid' };
    }

    if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
      const obj = event.data.object as { metadata?: Record<string, string>; id?: string };
      const orderId = obj.metadata?.orderId;
      if (orderId) {
        const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
        if (order && order.status === 'pending') {
          await this.prisma.billingPayment.create({
            data: {
              orderId: order.id,
              providerEventId: event.id,
              eventType: event.type,
              status: 'processed',
              rawPayload: event.data.object as unknown as Prisma.InputJsonValue,
            },
          });
          await this.prisma.billingOrder.update({
            where: { id: order.id },
            data: { status: 'failed', failedAt: new Date(), note: event.type },
          });
        }
      }
      return { ok: true, message: `Đã xử lý ${event.type}` };
    }

    // Event khác: ghi log rồi bỏ qua
    await this.prisma.billingPayment.create({
      data: {
        orderId: '00000000-0000-0000-0000-000000000000',
        providerEventId: event.id,
        eventType: event.type,
        status: 'ignored',
        rawPayload: event.data.object as unknown as Prisma.InputJsonValue,
        errorMessage: 'Event type chưa được hỗ trợ',
      },
    });
    return { ok: true, message: `Bỏ qua event type ${event.type}` };
  }

  /**
   * Cập nhật order = paid + cấp credit + ghi audit log trong 1 transaction.
   */
  private async markPaidAndGrant(
    order: { id: string; tenantId: string; companyId: string; creditCountSnapshot: number; priceVndSnapshot: bigint },
    eventId: string,
    extra: { mock: boolean; paymentIntent?: string | null; outcome?: string },
  ): Promise<BillingOrderView> {
    return this.prisma.$transaction(async (tx) => {
      // 1) Cập nhật order
      const updated = await tx.billingOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          providerPaymentIntent: extra.paymentIntent ?? null,
        },
      });

      // 2) Upsert account + cộng credit
      const account = await tx.billingCreditAccount.upsert({
        where: { companyId: order.companyId },
        create: { companyId: order.companyId, tenantId: order.tenantId, balance: 0 },
        update: {},
      });
      const updatedAccount = await tx.billingCreditAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: order.creditCountSnapshot },
          lifetimeGranted: { increment: order.creditCountSnapshot },
          lastActivityAt: new Date(),
        },
      });

      // 3) Ghi transaction
      await tx.billingCreditTransaction.create({
        data: {
          tenantId: order.tenantId,
          companyId: order.companyId,
          accountId: account.id,
          type: 'topup',
          action: 'manual_grant',
          creditDelta: order.creditCountSnapshot,
          balanceAfter: updatedAccount.balance,
          costPerUnit: 0,
          quantity: 1,
          actorUserId: null,
          actorEmail: extra.mock ? 'system:mock-payment' : 'system:stripe-webhook',
          note: `Top-up ${order.creditCountSnapshot} credit qua ${extra.mock ? 'Stripe Mock' : 'Stripe'} (order ${order.id})`,
          metadata: {
            orderId: order.id,
            eventId,
            priceVnd: order.priceVndSnapshot.toString(),
            paymentIntent: extra.paymentIntent ?? null,
          },
          enforced: true,
        },
      });

      // 4) Audit log
      await tx.billingAuditLog.create({
        data: {
          entity: 'credit_ledger',
          entityKey: order.companyId,
          action: 'topup',
          diff: {
            source: extra.mock ? 'stripe-mock' : 'stripe',
            orderId: order.id,
            eventId,
            creditDelta: order.creditCountSnapshot,
            priceVnd: order.priceVndSnapshot.toString(),
            before: { balance: account.balance, lifetimeGranted: account.lifetimeGranted },
            after: { balance: updatedAccount.balance, lifetimeGranted: updatedAccount.lifetimeGranted },
          },
          actorId: null,
          actorEmail: extra.mock ? 'system:mock-payment' : 'system:stripe-webhook',
        },
      });

      return this.mapOrder(updated);
    });
  }

  // =====================================================================
  // LIST ORDERS
  // =====================================================================

  async listOrdersForCompany(
    companyId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<RecruiterOrderListResponse> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.billingOrder.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.billingOrder.count({ where: { companyId } }),
    ]);
    return {
      items: items.map((o) => this.mapOrder(o)),
      total,
    };
  }

  async getOrder(orderId: string, companyId?: string): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order không tồn tại');
    if (companyId && order.companyId !== companyId) {
      throw new NotFoundException('Order không tồn tại');
    }
    return this.mapOrder(order);
  }

  private mapOrder(o: {
    id: string;
    companyId: string;
    topupId: string;
    creditCountSnapshot: number;
    priceVndSnapshot: bigint;
    status: string;
    provider: string;
    providerSessionId: string | null;
    providerPaymentIntent: string | null;
    createdByEmail: string | null;
    createdAt: Date;
    paidAt: Date | null;
    failedAt: Date | null;
    note: string | null;
  }): BillingOrderView {
    return {
      id: o.id,
      companyId: o.companyId,
      topupId: o.topupId,
      creditCountSnapshot: o.creditCountSnapshot,
      priceVndSnapshot: o.priceVndSnapshot.toString(),
      status: o.status as BillingOrderView['status'],
      provider: o.provider as BillingOrderView['provider'],
      providerSessionId: o.providerSessionId,
      providerPaymentIntent: o.providerPaymentIntent,
      createdByEmail: o.createdByEmail,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      failedAt: o.failedAt ? o.failedAt.toISOString() : null,
      note: o.note,
    };
  }
}
