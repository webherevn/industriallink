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
import { UserRole, payableVnd, vatAmountVnd } from '@industriallink/contracts';
import { vatPercentOrEmpty } from '../crm/commission-notices';
import { decryptSecret, encryptSecret, keyPreview } from '../ai/ai-settings.cipher';
import { BillingService } from './billing.service';
import { SourcingService } from './sourcing.service';
import { CrmService } from '../crm/crm.service';
import {
  mergeReferralMetadata,
  referralForPayingAccount,
  referralFromMetadata,
  type ReferralStamp,
} from '../crm/referral-cookie';
import { applyLaunchPromo, launchPromoFor } from './launch-promo';

const SCOPE = 'default';
type Row = Prisma.BillingPaymentSettingGetPayload<Record<string, never>>;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly billing: BillingService,
    private readonly sourcing: SourcingService,
    private readonly crm: CrmService,
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
    await this.billing.assertStarterTopupAllowed(companyId);
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
      form.set('line_items[0][price_data][unit_amount]', String(Number(payableVnd(order.priceVndSnapshot, order.vatPercent))));
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

  /**
   * Đơn mua gói tin hoặc gói Săn. Gán gói chỉ khi thanh toán thành công.
   * Giá 0đ thì ghi nhận đã thanh toán và gán ngay.
   */
  async createCatalogCheckout(
    user: AuthenticatedUser,
    companyId: string,
    kind: 'platform' | 'sourcing',
    planCode: string,
    webOrigin: string,
    referralCookie?: string | null,
  ): Promise<PaymentCheckoutResponse> {
    const platform =
      kind === 'platform'
        ? await this.prisma.billingPlatformPlan.findFirst({
            where: { code: planCode, isActive: true },
          })
        : null;
    const sourcing =
      kind === 'sourcing'
        ? await this.prisma.billingSourcingPlan.findFirst({
            where: { code: planCode, isActive: true },
          })
        : null;
    const plan = platform ?? sourcing;
    if (!plan) throw new NotFoundException('Không tìm thấy gói hoặc gói đã tắt');
    if (platform?.code === 'ENTERPRISE') {
      throw new BadRequestException('Gói Enterprise liên hệ sales — không tự thanh toán');
    }

    const listPrice = platform ? platform.priceVnd : sourcing!.feeVnd;
    const promo = launchPromoFor(kind, plan.code);
    const priceVnd = applyLaunchPromo(listPrice, promo.percent);
    const settings = await this.row();
    const mode = (settings?.mode as PaymentMode) ?? 'mock';
    const sessionId = `cs_${mode === 'live' ? 'test' : 'mock'}_${randomBytes(12).toString('hex')}`;
    const order = await this.createOrder({
      user,
      companyId,
      topupId: null,
      creditCount: 0,
      priceVnd,
      provider: mode === 'live' && priceVnd > 0n ? 'stripe' : 'stripe-mock',
      sessionId,
      kind,
      planCode: plan.code,
      planName: plan.name,
      referral: await this.referralStampForPayer(user, referralCookie),
      promo:
        promo.percent > 0
          ? { listPriceVnd: listPrice.toString(), percent: promo.percent, code: promo.code }
          : null,
    });

    if (priceVnd <= 0n) {
      await this.markPaidAndGrant(order, `evt_free_${randomBytes(6).toString('hex')}`, {
        mock: true,
        outcome: 'free',
      });
      const url = new URL(
        kind === 'sourcing' ? '/recruiter/sourcing' : '/recruiter/billing',
        webOrigin,
      ).toString();
      return { orderId: order.id, sessionId, url, mode };
    }

    if (mode === 'live') {
      const secretKey = this.decrypt(settings?.stripeSecretKeyEnc);
      if (!secretKey) {
        throw new BadRequestException(
          'Chưa cấu hình Stripe Secret Key. Vào /admin/billing/payment để thêm hoặc chuyển sang Mock.',
        );
      }
      const successUrl = (settings?.successUrl ?? '/recruiter/billing/topup/success?session={CHECKOUT_SESSION_ID}').replace(
        '{CHECKOUT_SESSION_ID}',
        sessionId,
      );
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', new URL(successUrl, webOrigin).toString());
      form.set('cancel_url', new URL(settings?.cancelUrl ?? '/recruiter/billing/topup/cancel', webOrigin).toString());
      form.set('client_reference_id', order.id);
      form.set('line_items[0][price_data][currency]', 'vnd');
      form.set('line_items[0][price_data][product_data][name]', plan.name);
      form.set('line_items[0][price_data][unit_amount]', String(Number(payableVnd(order.priceVndSnapshot, order.vatPercent))));
      form.set('line_items[0][quantity]', '1');
      form.set('metadata[orderId]', order.id);
      form.set('metadata[companyId]', companyId);
      form.set('metadata[kind]', kind);
      form.set('metadata[planCode]', plan.code);
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
        await this.prisma.billingOrder.update({
          where: { id: order.id },
          data: { status: 'failed', failedAt: new Date(), note: `Stripe API ${res.status}` },
        });
        throw new BadRequestException('Stripe từ chối tạo session. Kiểm tra Secret Key.');
      }
      const data = (await res.json()) as { id: string; url: string };
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: { providerSessionId: data.id },
      });
      return { orderId: order.id, sessionId: data.id, url: data.url, mode: 'live' };
    }

    const url = new URL(
      `/recruiter/billing/topup/mock-checkout?session=${sessionId}&order=${order.id}`,
      webOrigin,
    ).toString();
    return { orderId: order.id, sessionId, url, mode: 'mock' };
  }

  private async createOrder(args: {
    user: AuthenticatedUser;
    companyId: string;
    topupId: string | null;
    creditCount: number;
    priceVnd: bigint;
    provider: 'stripe' | 'stripe-mock';
    sessionId: string;
    kind?: 'topup' | 'platform' | 'sourcing';
    planCode?: string | null;
    planName?: string | null;
    referral?: ReferralStamp | null;
    promo?: { listPriceVnd: string; percent: number; code: string | null } | null;
  }) {
    const vatPercent = await this.currentVatPercent();
    const promoMeta = args.promo
      ? {
          listPriceVnd: args.promo.listPriceVnd,
          promoPercent: args.promo.percent,
          promoCode: args.promo.code,
        }
      : null;
    const metadata = args.referral
      ? mergeReferralMetadata(promoMeta ?? {}, args.referral.code, args.referral.capturedAt)
      : promoMeta;
    return this.prisma.billingOrder.create({
      data: {
        tenantId: args.user.tenantId,
        companyId: args.companyId,
        kind: args.kind ?? 'topup',
        topupId: args.topupId,
        creditCountSnapshot: args.creditCount,
        priceVndSnapshot: args.priceVnd,
        vatPercent,
        vatAmountVnd: vatAmountVnd(args.priceVnd, vatPercent),
        planCode: args.planCode ?? null,
        planName: args.planName ?? null,
        status: 'pending',
        provider: args.provider,
        providerSessionId: args.sessionId,
        createdByUserId: args.user.id,
        createdByEmail: args.user.email ?? null,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  /** Cookie chỉ gắn vào đơn khi đúng nhà tuyển dụng đăng ký sau lần bấm link. */
  private async referralStampForPayer(
    user: AuthenticatedUser,
    raw: string | null | undefined,
  ): Promise<ReferralStamp | null> {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, createdAt: true },
    });
    if (!account) return null;
    const stamp = referralForPayingAccount({
      cookie: raw,
      role: account.role,
      userCreatedAt: account.createdAt,
    });
    if (!stamp) return null;
    const partner = await this.prisma.crmPartner.findUnique({
      where: { code: stamp.code },
      select: { id: true },
    });
    return partner ? stamp : null;
  }

  // =====================================================================
  // WEBHOOK HANDLERS
  // =====================================================================

  /** Xử lý khi user bấm "Thanh toán thành công" trên mock page. */
  async handleMockSuccess(
    orderId: string,
    user: AuthenticatedUser,
    referralCookie?: string | null,
  ): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order không tồn tại');
    if (order.status !== 'pending') {
      throw new BadRequestException(`Order đã ở trạng thái ${order.status}, không thể thay đổi.`);
    }
    const stamp = await this.referralStampForPayer(user, referralCookie);
    if (stamp && (order.kind === 'platform' || order.kind === 'sourcing')) {
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: {
          metadata: mergeReferralMetadata(order.metadata, stamp.code, stamp.capturedAt) as Prisma.InputJsonValue,
        },
      });
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
        amountVnd: order.priceVndSnapshot + order.vatAmountVnd,
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
          amountVnd: BigInt(sessionObj.amount_total ?? Number(order.priceVndSnapshot + order.vatAmountVnd)),
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
   * Gán gói (nếu là đơn gói) rồi đánh dấu đã thanh toán.
   * Chỉ đơn Top-up mới cộng credit. Gán trước khi đổi trạng thái để lần bấm lại vẫn chạy được nếu gán lỗi.
   */
  private async markPaidAndGrant(
    order: {
      id: string;
      tenantId: string;
      companyId: string;
      kind?: string;
      planCode?: string | null;
      creditCountSnapshot: number;
      priceVndSnapshot: bigint;
      createdByUserId: string;
      createdByEmail: string | null;
    },
    eventId: string,
    extra: { mock: boolean; paymentIntent?: string | null; outcome?: string },
  ): Promise<BillingOrderView> {
    const fresh = await this.prisma.billingOrder.findUnique({ where: { id: order.id } });
    if (!fresh) throw new NotFoundException('Order không tồn tại');
    if (fresh.status !== 'pending') return this.mapOrder(fresh);

    const kind = fresh.kind === 'platform' || fresh.kind === 'sourcing' ? fresh.kind : 'topup';
    const planCode = fresh.planCode;
    if ((kind === 'platform' || kind === 'sourcing') && planCode) {
      const actor = this.actorFromOrder(fresh);
      if (kind === 'platform') {
        await this.billing.activatePurchasedPlan(actor, fresh.companyId, planCode);
      } else {
        await this.sourcing.activatePurchasedPlan(actor, fresh.companyId, planCode);
      }
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.billingOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          providerPaymentIntent: extra.paymentIntent ?? null,
        },
      });

      if (kind === 'topup' && order.creditCountSnapshot > 0) {
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
      } else {
        await tx.billingAuditLog.create({
          data: {
            entity: 'billing_order',
            entityKey: order.id,
            action: 'paid',
            diff: {
              source: extra.mock ? 'stripe-mock' : 'stripe',
              kind,
              planCode,
              eventId,
              priceVnd: order.priceVndSnapshot.toString(),
            },
            actorId: null,
            actorEmail: extra.mock ? 'system:mock-payment' : 'system:stripe-webhook',
          },
        });
      }

      try {
        await this.crm.recordPaidOrderCommission(tx, {
          id: updated.id,
          companyId: updated.companyId,
          kind,
          planCode: updated.planCode,
          planName: updated.planName,
          priceVndSnapshot: updated.priceVndSnapshot,
          paidAt: updated.paidAt ?? new Date(),
          referralCode: referralFromMetadata(updated.metadata),
        });
      } catch (err) {
        this.logger.error(`Không ghi được hoa hồng cho đơn ${updated.id}: ${String(err)}`);
      }

      try {
        await this.crm.recordPaidOrderActivity(tx, {
          id: updated.id,
          companyId: updated.companyId,
          kind,
          planCode: updated.planCode,
          planName: updated.planName,
          priceVndSnapshot: updated.priceVndSnapshot,
          paidAt: updated.paidAt ?? new Date(),
        });
      } catch (err) {
        this.logger.error(`Không ghi được nhật ký thanh toán cho đơn ${updated.id}: ${String(err)}`);
      }

      return this.mapOrder(updated);
    });

    if (kind === 'topup') {
      await this.billing.ensureCompanyPlan(order.companyId).catch((err) => {
        this.logger.error(`Không chốt được Credit Khám phá cho ${order.companyId}: ${String(err)}`);
      });
    }
    return paid;
  }

  private actorFromOrder(order: {
    createdByUserId: string;
    createdByEmail: string | null;
    tenantId: string;
  }): AuthenticatedUser {
    return {
      id: order.createdByUserId,
      email: order.createdByEmail ?? 'system:payment',
      role: UserRole.Recruiter,
      tenantId: order.tenantId,
      displayName: 'Thanh toán',
      status: 'active',
    };
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

  private async currentVatPercent(): Promise<number | null> {
    const row = await this.prisma.crmVatSetting.findUnique({ where: { id: 'default' }, select: { percent: true } });
    return vatPercentOrEmpty(row?.percent);
  }

  private mapOrder(o: {
    id: string;
    companyId: string;
    kind: string;
    topupId: string | null;
    planCode: string | null;
    planName: string | null;
    creditCountSnapshot: number;
    priceVndSnapshot: bigint;
    vatPercent: number | null;
    vatAmountVnd: bigint;
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
    const kind = o.kind === 'platform' || o.kind === 'sourcing' ? o.kind : 'topup';
    return {
      id: o.id,
      companyId: o.companyId,
      kind,
      topupId: o.topupId,
      planCode: o.planCode,
      planName: o.planName,
      creditCountSnapshot: o.creditCountSnapshot,
      priceVndSnapshot: o.priceVndSnapshot.toString(),
      vatPercent: o.vatPercent,
      vatAmountVnd: o.vatAmountVnd.toString(),
      payableVnd: (o.priceVndSnapshot + o.vatAmountVnd).toString(),
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
