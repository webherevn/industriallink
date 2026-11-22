import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AdminBillingOrderView,
  BankTransferOrderView,
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
import { JobPackageService } from './job-package.service';
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
    private readonly jobPackages: JobPackageService,
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
    const bankWh = this.decrypt(row?.bankWebhookSecretEnc);
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
      bankBin: row?.bankBin ?? null,
      bankName: row?.bankName ?? null,
      bankAccountNumber: row?.bankAccountNumber ?? null,
      bankAccountName: row?.bankAccountName ?? null,
      bankBranch: row?.bankBranch ?? null,
      transferPrefix: row?.transferPrefix ?? 'INLINK',
      bankTransferNote: row?.bankTransferNote ?? null,
      hasBankWebhookSecret: Boolean(bankWh),
      bankWebhookSecretPreview: keyPreview(bankWh),
    };
  }

  async updateSettings(
    dto: UpdatePaymentSettingsRequest,
    adminId: string,
  ): Promise<BillingPaymentSettingView> {
    if (dto.mode && !['mock', 'bank_transfer', 'live'].includes(dto.mode)) {
      throw new BadRequestException('mode chỉ nhận "mock", "bank_transfer" hoặc "live"');
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
    const bankWhEnc = keyUpdate(dto.bankWebhookSecret);
    if (bankWhEnc !== undefined) data.bankWebhookSecretEnc = bankWhEnc;
    if (dto.bankBin !== undefined) data.bankBin = dto.bankBin?.trim() || null;
    if (dto.bankName !== undefined) data.bankName = dto.bankName?.trim() || null;
    if (dto.bankAccountNumber !== undefined) {
      data.bankAccountNumber = dto.bankAccountNumber?.replace(/\s+/g, '').trim() || null;
    }
    if (dto.bankAccountName !== undefined) {
      data.bankAccountName = dto.bankAccountName?.trim().toUpperCase() || null;
    }
    if (dto.bankBranch !== undefined) data.bankBranch = dto.bankBranch?.trim() || null;
    if (dto.transferPrefix !== undefined) {
      const cleaned = (dto.transferPrefix ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12);
      data.transferPrefix = cleaned || 'INLINK';
    }
    if (dto.bankTransferNote !== undefined) {
      data.bankTransferNote = dto.bankTransferNote?.trim() || null;
    }

    await this.prisma.billingPaymentSetting.upsert({
      where: { scope: SCOPE },
      create: { scope: SCOPE, ...(data as Prisma.BillingPaymentSettingUncheckedCreateInput) },
      update: data,
    });

    return this.getSettingsView();
  }

  private assertBankSettingsReady(settings: Row | null): {
    bankBin: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    bankBranch: string | null;
    transferPrefix: string;
    bankTransferNote: string | null;
  } {
    const bankBin = settings?.bankBin?.trim() ?? '';
    const bankName = settings?.bankName?.trim() ?? '';
    const bankAccountNumber = settings?.bankAccountNumber?.replace(/\s+/g, '').trim() ?? '';
    const bankAccountName = settings?.bankAccountName?.trim() ?? '';
    if (!bankBin || !bankAccountNumber || !bankAccountName) {
      throw new BadRequestException(
        'Chưa cấu hình tài khoản ngân hàng công ty. Vui lòng vào /admin/billing/payment để thiết lập.',
      );
    }
    return {
      bankBin,
      bankName: bankName || bankBin,
      bankAccountNumber,
      bankAccountName,
      bankBranch: settings?.bankBranch?.trim() || null,
      transferPrefix: (settings?.transferPrefix?.trim() || 'INLINK').toUpperCase(),
      bankTransferNote: settings?.bankTransferNote?.trim() || null,
    };
  }

  private generateTransferCode(prefix: string): string {
    const digits = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
    return `${prefix}${digits}`;
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

    if (mode === 'bank_transfer') {
      const bank = this.assertBankSettingsReady(settings);
      const transferCode = this.generateTransferCode(bank.transferPrefix);
      const sessionId = `bt_${transferCode}`;
      const order = await this.createOrder({
        user,
        companyId,
        topupId: topup.id,
        creditCount: topup.creditCount,
        priceVnd: topup.priceVnd,
        provider: 'bank_transfer',
        sessionId,
        planName: topup.name,
      });
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: {
          metadata: {
            ...((order.metadata && typeof order.metadata === 'object' ? order.metadata : {}) as Record<string, unknown>),
            transferCode,
          } as Prisma.InputJsonValue,
        },
      });
      const url = new URL(
        `/recruiter/billing/bank-transfer?order=${order.id}`,
        webOrigin,
      ).toString();
      return { orderId: order.id, sessionId, url, mode: 'bank_transfer' };
    }

    if (mode === 'live') {
      // Gọi Stripe API thật (yêu cầu node 18+ có global fetch).
      const secretKey = this.decrypt(settings?.stripeSecretKeyEnc);
      if (!secretKey) {
        throw new BadRequestException(
          'Chưa cấu hình Stripe Secret Key. Vào /admin/billing/payment để thêm hoặc chuyển sang Mock.',
        );
      }
      const sessionId = `cs_test_${randomBytes(16).toString('hex')}`;
      const cancelFull = new URL(cancelUrl, webOrigin).toString();
      // Giữ nguyên placeholder {CHECKOUT_SESSION_ID} để Stripe tự điền session ID thật khi redirect.
      const successFull = new URL(successUrlTemplate, webOrigin)
        .toString()
        .replace(/%7BCHECKOUT_SESSION_ID%7D/gi, '{CHECKOUT_SESSION_ID}');
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
      form.set('payment_intent_data[metadata][orderId]', order.id);
      form.set('payment_intent_data[metadata][companyId]', companyId);
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
    const bankConfig = mode === 'bank_transfer' && priceVnd > 0n ? this.assertBankSettingsReady(settings) : null;
    const transferCode = bankConfig ? this.generateTransferCode(bankConfig.transferPrefix) : null;
    const sessionId = transferCode
      ? `bt_${transferCode}`
      : `cs_${mode === 'live' ? 'test' : 'mock'}_${randomBytes(12).toString('hex')}`;
    const order = await this.createOrder({
      user,
      companyId,
      topupId: null,
      creditCount: 0,
      priceVnd,
      provider:
        priceVnd <= 0n
          ? 'stripe-mock'
          : mode === 'bank_transfer'
            ? 'bank_transfer'
            : mode === 'live'
              ? 'stripe'
              : 'stripe-mock',
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

    if (transferCode) {
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: {
          metadata: {
            ...((order.metadata && typeof order.metadata === 'object' ? order.metadata : {}) as Record<string, unknown>),
            transferCode,
          } as Prisma.InputJsonValue,
        },
      });
    }

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

    if (mode === 'bank_transfer') {
      const url = new URL(
        `/recruiter/billing/bank-transfer?order=${order.id}`,
        webOrigin,
      ).toString();
      return { orderId: order.id, sessionId, url, mode: 'bank_transfer' };
    }

    if (mode === 'live') {
      const secretKey = this.decrypt(settings?.stripeSecretKeyEnc);
      if (!secretKey) {
        throw new BadRequestException(
          'Chưa cấu hình Stripe Secret Key. Vào /admin/billing/payment để thêm hoặc chuyển sang Mock.',
        );
      }
      const successTpl =
        settings?.successUrl ?? '/recruiter/billing/topup/success?session={CHECKOUT_SESSION_ID}';
      const successFull = new URL(successTpl, webOrigin)
        .toString()
        .replace(/%7BCHECKOUT_SESSION_ID%7D/gi, '{CHECKOUT_SESSION_ID}');
      const form = new URLSearchParams();
      form.set('mode', 'payment');
      form.set('success_url', successFull);
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
      form.set('payment_intent_data[metadata][orderId]', order.id);
      form.set('payment_intent_data[metadata][companyId]', companyId);
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
    provider: 'stripe' | 'stripe-mock' | 'bank_transfer';
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
    const settings = await this.row();
    const mode = (settings?.mode as PaymentMode) ?? 'mock';
    if (order.provider !== 'stripe-mock' || (mode !== 'mock' && order.priceVndSnapshot > 0n)) {
      throw new BadRequestException('Thanh toán giả lập không khả dụng ở chế độ hiện tại.');
    }
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
    const settings = await this.row();
    const mode = (settings?.mode as PaymentMode) ?? 'mock';
    if (order.provider !== 'stripe-mock' || (mode !== 'mock' && order.priceVndSnapshot > 0n)) {
      throw new BadRequestException('Thanh toán giả lập không khả dụng ở chế độ hiện tại.');
    }
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
        this.logger.warn(
          `Stripe webhook ${event.id} (${event.type}) thiếu metadata.orderId — bỏ qua không ghi bảng billing_payment.`,
        );
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

    if (event.type === 'charge.refunded' || event.type === 'refund.created') {
      const obj = event.data.object as {
        metadata?: Record<string, string>;
        payment_intent?: string;
        amount?: number;
        amount_refunded?: number;
      };
      // Chỉ xử lý hoàn toàn bộ đơn (tránh hủy 100% hoa hồng khi hoàn tiền một phần).
      if (
        event.type === 'charge.refunded' &&
        typeof obj.amount === 'number' &&
        typeof obj.amount_refunded === 'number' &&
        obj.amount_refunded < obj.amount
      ) {
        this.logger.warn(`Bỏ qua hoàn tiền một phần (${obj.amount_refunded}/${obj.amount}) cho event ${event.id}`);
        return { ok: true, message: 'Bỏ qua partial refund' };
      }
      const orderId = obj.metadata?.orderId;
      const paymentIntent = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
      const order = orderId
        ? await this.prisma.billingOrder.findUnique({ where: { id: orderId } })
        : paymentIntent
          ? await this.prisma.billingOrder.findFirst({ where: { providerPaymentIntent: paymentIntent } })
          : null;
      if (!order) {
        return { ok: false, message: 'Không tìm thấy đơn hàng tương ứng cho refund' };
      }
      // Bỏ qua hoàn tiền một phần cho cả charge.refunded và refund.created.
      const orderGross = order.priceVndSnapshot + order.vatAmountVnd;
      if (
        event.type === 'refund.created' &&
        typeof obj.amount === 'number' &&
        BigInt(obj.amount) < orderGross
      ) {
        this.logger.warn(
          `Bỏ qua partial refund.created (${obj.amount}/${orderGross.toString()}) cho event ${event.id}`,
        );
        return { ok: true, message: 'Bỏ qua partial refund' };
      }
      await this.prisma.billingPayment.create({
        data: {
          orderId: order.id,
          providerEventId: event.id,
          eventType: event.type,
          status: 'processed',
          rawPayload: event.data.object as unknown as Prisma.InputJsonValue,
        },
      });
      await this.markRefunded(order);
      return { ok: true, message: 'Order marked refunded' };
    }

    // Event khác: bỏ qua (không insert billing_payment với orderId giả vì vi phạm FK)
    this.logger.debug(`Bỏ qua Stripe webhook event chưa hỗ trợ: ${event.type} (${event.id})`);
    return { ok: true, message: `Bỏ qua event type ${event.type}` };
  }

  /**
   * Đánh dấu đã thanh toán một cách atomic (chống race condition cấp trùng),
   * sau đó gán gói và cộng Credit / ghi hoa hồng.
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
    const paidAt = new Date();
    // Khóa atomic: chỉ đúng 1 request chuyển được từ pending → paid
    const claimed = await this.prisma.billingOrder.updateMany({
      where: { id: order.id, status: 'pending' },
      data: {
        status: 'paid',
        paidAt,
        providerPaymentIntent: extra.paymentIntent ?? null,
      },
    });
    const fresh = await this.prisma.billingOrder.findUnique({ where: { id: order.id } });
    if (!fresh) throw new NotFoundException('Order không tồn tại');
    if (claimed.count !== 1) return this.mapOrder(fresh);

    const kind = fresh.kind === 'platform' || fresh.kind === 'sourcing' ? fresh.kind : 'topup';
    const planCode = fresh.planCode;
    // Gói lẻ (Tin đăng / Tin đăng Plus): KHÔNG gán gói 1:1 lúc thanh toán.
    // Gói này nằm ở trạng thái "chờ kích hoạt" cho tới khi NTD bấm "Sử dụng gói này",
    // lúc đó mới cấp Credit + mở lượt đăng (không ghi đè các gói khác đang chạy).
    const isOneOffJobPackage =
      kind === 'platform' && planCode ? this.jobPackages.isOneOffPlan(planCode) : false;
    try {
      if ((kind === 'platform' || kind === 'sourcing') && planCode && !isOneOffJobPackage) {
        const actor = this.actorFromOrder(fresh);
        if (kind === 'platform') {
          await this.billing.activatePurchasedPlan(actor, fresh.companyId, planCode);
        } else {
          await this.sourcing.activatePurchasedPlan(actor, fresh.companyId, planCode);
        }
      }

      // Gói tin đăng multi-active: mỗi đơn gói nền tảng đã trả = 1 gói độc lập.
      if (kind === 'platform' && planCode) {
        await this.createJobPackageForOrder(fresh);
      }

      // Gói Săn multi-active (1-1 với chiến dịch): mỗi đơn gói Săn đã trả = 1 gói UNUSED.
      if (kind === 'sourcing' && planCode) {
        await this.createHuntPackageForOrder(fresh);
      }
    } catch (err) {
      // Hoàn tác trạng thái về pending nếu gán/tạo gói thất bại để lần thử lại chạy được.
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: { status: 'pending', paidAt: null },
      });
      throw err;
    }

    const isBankTransfer =
      extra.outcome === 'bank_webhook' || extra.outcome === 'admin_bank_confirm';
    const paymentActorEmail = extra.mock
      ? 'system:mock-payment'
      : extra.outcome === 'admin_bank_confirm'
        ? 'admin:bank-confirm'
        : extra.outcome === 'bank_webhook'
          ? 'system:bank-webhook'
          : 'system:stripe-webhook';
    const paymentSource = extra.mock
      ? 'stripe-mock'
      : isBankTransfer
        ? 'bank_transfer'
        : 'stripe';
    const paymentChannelLabel = extra.mock
      ? 'Stripe Mock'
      : isBankTransfer
        ? 'Chuyển khoản ngân hàng (VietQR)'
        : 'Stripe';

    const paid = await this.prisma.$transaction(async (tx) => {
      const updated = fresh;

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
        // Lô Credit nạp tiền → vô thời hạn, GIỮ LẠI trong ví dùng chung.
        await tx.billingCreditLot.create({
          data: {
            companyId: order.companyId,
            accountId: account.id,
            sourceType: 'topup',
            sourceKey: order.id,
            granted: order.creditCountSnapshot,
            consumed: 0,
            expiresAt: null,
          },
        });

        await tx.billingCreditTransaction.create({
          data: {
            tenantId: order.tenantId,
            companyId: order.companyId,
            accountId: account.id,
            type: 'topup',
            action: 'topup',
            creditDelta: order.creditCountSnapshot,
            balanceAfter: updatedAccount.balance,
            costPerUnit: 0,
            quantity: 1,
            actorUserId: null,
            actorEmail: paymentActorEmail,
            note: `Top-up ${order.creditCountSnapshot} credit qua ${paymentChannelLabel} (order ${order.id})`,
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
              source: paymentSource,
              orderId: order.id,
              eventId,
              creditDelta: order.creditCountSnapshot,
              priceVnd: order.priceVndSnapshot.toString(),
              before: { balance: account.balance, lifetimeGranted: account.lifetimeGranted },
              after: { balance: updatedAccount.balance, lifetimeGranted: updatedAccount.lifetimeGranted },
            },
            actorId: null,
            actorEmail: paymentActorEmail,
          },
        });
      } else {
        await tx.billingAuditLog.create({
          data: {
            entity: 'billing_order',
            entityKey: order.id,
            action: 'paid',
            diff: {
              source: paymentSource,
              kind,
              planCode,
              eventId,
              priceVnd: order.priceVndSnapshot.toString(),
            },
            actorId: null,
            actorEmail: paymentActorEmail,
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
          vatAmountVnd: updated.vatAmountVnd,
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

  /**
   * Đánh dấu đơn đã hoàn tiền và xử lý lại hoa hồng CTV.
   *
   *  - Kỳ đối soát đang OPEN → dòng hoa hồng bị VOID, tính lại bậc tháng.
   *  - Kỳ đã chốt → giữ nguyên lịch sử, ghi khoản điều chỉnh âm vào kỳ hiện tại.
   *
   * Không trả tiền — chỉ cập nhật số liệu hoa hồng.
   */
  private async markRefunded(order: { id: string; companyId: string; paidAt: Date | null }): Promise<void> {
    // Khóa atomic: tránh charge.refunded và refund.created chạy song song trừ trùng hoa hồng.
    const claimed = await this.prisma.billingOrder.updateMany({
      where: { id: order.id, status: { not: 'refunded' } },
      data: { status: 'refunded', refundedAt: new Date() },
    });
    if (claimed.count !== 1) return;
    const fresh = await this.prisma.billingOrder.findUnique({ where: { id: order.id } });
    if (!fresh) throw new NotFoundException('Order không tồn tại');

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.crm.handleOrderRefund(tx, {
          id: fresh.id,
          companyId: fresh.companyId,
          paidAt: fresh.paidAt,
        });
      });
    } catch (err) {
      // Không chặn luồng hoàn tiền vì lỗi cập nhật hoa hồng — ghi log để kế toán xử lý.
      this.logger.error(
        `Không cập nhật được hoa hồng cho đơn hoàn tiền ${fresh.id}: ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
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

  /**
   * Tạo 1 gói tin đăng độc lập cho đơn gói nền tảng đã trả.
   *
   * Idempotent theo `orderId`: bấm thanh toán lại nhiều lần chỉ có 1 gói.
   */
  private async createJobPackageForOrder(order: {
    id: string;
    tenantId: string;
    companyId: string;
    planCode: string | null;
    planName: string | null;
    priceVndSnapshot: bigint;
    paidAt: Date | null;
  }): Promise<void> {
    const existing = await this.prisma.billingJobPackage.findFirst({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existing) return;

    const plan = order.planCode
      ? await this.prisma.billingPlatformPlan.findFirst({
          where: { code: order.planCode },
        })
      : null;

    await this.jobPackages.createForOrder({
      orderId: order.id,
      companyId: order.companyId,
      tenantId: order.tenantId,
      planCode: order.planCode,
      planName: order.planName ?? plan?.name ?? null,
      planId: plan?.id ?? null,
      jobPostQuota: plan?.jobPostQuota ?? null,
      creditQuota: plan?.creditQuota ?? null,
      durationDays: plan?.durationDays ?? null,
      priceVnd: order.priceVndSnapshot,
      paidAt: order.paidAt ?? new Date(),
    });
  }

  /**
   * Tạo 1 gói Săn UNUSED cho đơn gói Săn đã trả (1 gói ↔ 1 chiến dịch).
   *
   * Idempotent theo `orderId`: bấm thanh toán lại nhiều lần chỉ có 1 gói.
   */
  private async createHuntPackageForOrder(order: {
    id: string;
    tenantId: string;
    companyId: string;
    planCode: string | null;
    planName: string | null;
    paidAt: Date | null;
  }): Promise<void> {
    const existing = await this.prisma.billingHuntPackage.findFirst({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existing) return;

    const plan = order.planCode
      ? await this.prisma.billingSourcingPlan.findFirst({
          where: { code: order.planCode },
        })
      : null;
    if (!plan) return;

    await this.sourcing.createPackageForOrder({
      orderId: order.id,
      companyId: order.companyId,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      durationDays: plan.durationDays ?? null,
      paidAt: order.paidAt ?? new Date(),
      creditsIncluded: plan.creditQuota,
      totalCriteriaEdits: plan.revisionQuota,
      totalReports: plan.searchRoundQuota,
      totalHandovers: plan.shortlistQuota,
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

  // =====================================================================
  // BANK TRANSFER (VietQR + SePay / Casso Webhook + SuperAdmin Confirm)
  // =====================================================================

  private extractTransferCode(order: {
    providerSessionId: string | null;
    metadata: Prisma.JsonValue;
  }): string | null {
    const meta =
      order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
        ? (order.metadata as Record<string, unknown>)
        : null;
    if (typeof meta?.transferCode === 'string' && meta.transferCode.trim()) {
      return meta.transferCode.trim().toUpperCase();
    }
    if (order.providerSessionId?.startsWith('bt_')) {
      return order.providerSessionId.slice(3).toUpperCase();
    }
    return null;
  }

  async getBankTransferOrder(companyId: string, orderId: string): Promise<BankTransferOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn thanh toán.');
    if (order.companyId !== companyId) {
      throw new ForbiddenException('Đơn hàng không thuộc công ty của bạn.');
    }
    const [settings, company] = await Promise.all([
      this.row(),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, taxCode: true },
      }),
    ]);
    const bank =
      order.status === 'pending'
        ? this.assertBankSettingsReady(settings)
        : {
            bankBin: settings?.bankBin?.trim() ?? '',
            bankName: settings?.bankName?.trim() || settings?.bankBin?.trim() || '',
            bankAccountNumber: settings?.bankAccountNumber?.replace(/\s+/g, '').trim() ?? '',
            bankAccountName: settings?.bankAccountName?.trim() ?? '',
            bankBranch: settings?.bankBranch?.trim() || null,
            transferPrefix: (settings?.transferPrefix?.trim() || 'INLINK').toUpperCase(),
            bankTransferNote: settings?.bankTransferNote?.trim() || null,
          };
    const transferCode =
      this.extractTransferCode(order) ?? `${bank.transferPrefix}${order.id.slice(0, 6).toUpperCase()}`;
    const totalPayable = order.priceVndSnapshot + order.vatAmountVnd;
    const qrImageUrl =
      bank.bankBin && bank.bankAccountNumber
        ? `https://img.vietqr.io/image/${encodeURIComponent(bank.bankBin)}-${encodeURIComponent(bank.bankAccountNumber)}-compact2.png?amount=${totalPayable.toString()}&addInfo=${encodeURIComponent(transferCode)}&accountName=${encodeURIComponent(bank.bankAccountName)}`
        : '';
    return {
      order: this.mapOrder(order),
      transferCode,
      payableVnd: totalPayable.toString(),
      bankBin: bank.bankBin,
      bankName: bank.bankName,
      bankAccountNumber: bank.bankAccountNumber,
      bankAccountName: bank.bankAccountName,
      bankBranch: bank.bankBranch,
      bankTransferNote: bank.bankTransferNote,
      qrImageUrl,
      companyName: company?.name ?? 'Doanh nghiệp',
      companyTaxCode: company?.taxCode ?? null,
    };
  }

  /**
   * Webhook đối soát tự động — hỗ trợ cả SePay & Casso.
   * Xác thực bằng Bank Webhook API Key (mã hoá AES trong BillingPaymentSetting).
   */
  async handleBankWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: Record<string, unknown>,
  ): Promise<{ ok: true; success: true; error: 0; matched: number; ignored: number }> {
    const settings = await this.row();
    const expectedKey = this.decrypt(settings?.bankWebhookSecretEnc);
    if (!expectedKey) {
      throw new UnauthorizedException('Chưa cấu hình Bank Webhook API Key trong SuperAdmin.');
    }
    const readHeader = (name: string): string => {
      const val = headers[name] ?? headers[name.toLowerCase()];
      return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
    };
    const authHeader = readHeader('authorization').trim();
    const suppliedKey =
      authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim() ||
      readHeader('secure-token').trim() ||
      readHeader('x-api-key').trim();

    const a = Buffer.from(suppliedKey);
    const b = Buffer.from(expectedKey);
    if (!suppliedKey || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Bank Webhook API Key không hợp lệ.');
    }

    const prefix = (settings?.transferPrefix?.trim() || 'INLINK').toUpperCase();
    const codeRegex = new RegExp(
      `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s-]?(\\d{6})`,
      'i',
    );

    type BankTxn = { id: string; amount: bigint; content: string; ref: string | null; raw: unknown };
    const txns: BankTxn[] = [];

    if (Array.isArray(payload?.data)) {
      // Định dạng Casso: { error: 0, data: [{ id, amount, description, tid }] }
      for (const item of payload.data as Array<Record<string, unknown>>) {
        const amt = Number(item.amount ?? 0);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        txns.push({
          id: String(item.tid || item.id || randomBytes(6).toString('hex')),
          amount: BigInt(Math.round(amt)),
          content: String(item.description ?? ''),
          ref: item.tid ? String(item.tid) : null,
          raw: item,
        });
      }
    } else if (payload && typeof payload === 'object') {
      // Định dạng SePay: { id, transferType: 'in', transferAmount, content, referenceCode }
      const transferType = String(payload.transferType ?? 'in').toLowerCase();
      const amt = Number(payload.transferAmount ?? payload.amount ?? 0);
      if (transferType === 'in' && Number.isFinite(amt) && amt > 0) {
        txns.push({
          id: String(payload.id || payload.referenceCode || randomBytes(6).toString('hex')),
          amount: BigInt(Math.round(amt)),
          content: String(payload.content ?? payload.description ?? ''),
          ref: payload.referenceCode ? String(payload.referenceCode) : null,
          raw: payload,
        });
      }
    }

    let matched = 0;
    let ignored = 0;

    for (const txn of txns) {
      const m = txn.content.toUpperCase().match(codeRegex);
      if (!m || !m[1]) {
        ignored += 1;
        continue;
      }
      const code = `${prefix}${m[1]}`;
      const order = await this.prisma.billingOrder.findFirst({
        where: { providerSessionId: `bt_${code}`, status: 'pending' },
      });
      if (!order) {
        ignored += 1;
        continue;
      }
      const expectedPayable = order.priceVndSnapshot + order.vatAmountVnd;
      if (txn.amount < expectedPayable) {
        this.logger.warn(
          `[BankWebhook] Chuyển thiếu tiền cho đơn ${order.id} (${code}): nhận ${txn.amount}đ / cần ${expectedPayable}đ`,
        );
        ignored += 1;
        continue;
      }
      const eventId = `bank_wh_${txn.id}`;
      const existingPayment = await this.prisma.billingPayment.findUnique({
        where: { providerEventId: eventId },
      });
      if (!existingPayment) {
        await this.prisma.billingPayment.create({
          data: {
            orderId: order.id,
            providerEventId: eventId,
            eventType: 'bank.transfer_in',
            status: 'processed',
            amountVnd: txn.amount,
            rawPayload: txn.raw as Prisma.InputJsonValue,
          },
        });
      }
      await this.markPaidAndGrant(order, eventId, {
        mock: false,
        paymentIntent: txn.ref ?? txn.id,
        outcome: 'bank_webhook',
      });
      matched += 1;
    }

    return { ok: true, success: true, error: 0, matched, ignored };
  }

  async listAdminOrders(status?: string): Promise<AdminBillingOrderView[]> {
    const allowed = new Set(['pending', 'paid', 'failed', 'refunded']);
    const where: Prisma.BillingOrderWhereInput =
      status && allowed.has(status) ? { status } : {};
    const rows = await this.prisma.billingOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const companyIds = [...new Set(rows.map((r) => r.companyId))];
    const companies = companyIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true, taxCode: true },
        })
      : [];
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    return rows.map((o) => {
      const co = companyMap.get(o.companyId);
      const base = this.mapOrder(o);
      return {
        ...base,
        companyName: co?.name ?? 'Không rõ công ty',
        companyTaxCode: co?.taxCode ?? null,
        transferCode: this.extractTransferCode(o),
        payableVnd: (o.priceVndSnapshot + o.vatAmountVnd).toString(),
      };
    });
  }

  async adminConfirmBankOrder(
    admin: AuthenticatedUser,
    orderId: string,
    bankReference?: string,
    note?: string,
  ): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status === 'paid') {
      return this.mapOrder(order);
    }
    if (order.status !== 'pending') {
      throw new BadRequestException(`Không thể xác nhận đơn ở trạng thái "${order.status}".`);
    }
    const ref = bankReference?.trim() || `MANUAL-${Date.now()}`;
    const eventId = `admin_bank_${order.id}_${randomBytes(4).toString('hex')}`;
    const totalPayable = order.priceVndSnapshot + order.vatAmountVnd;
    await this.prisma.billingPayment.create({
      data: {
        orderId: order.id,
        providerEventId: eventId,
        eventType: 'bank.admin_confirmed',
        status: 'processed',
        amountVnd: totalPayable,
        rawPayload: {
          adminId: admin.id,
          adminEmail: admin.email ?? null,
          bankReference: ref,
          note: note?.trim() || null,
        },
      },
    });
    const paid = await this.markPaidAndGrant(order, eventId, {
      mock: false,
      paymentIntent: ref,
      outcome: 'admin_bank_confirm',
    });
    let finalNote = paid.note;
    if (note?.trim()) {
      finalNote = `[Admin ${admin.email ?? admin.id}] ${note.trim()}`;
      await this.prisma.billingOrder.update({
        where: { id: order.id },
        data: { note: finalNote },
      });
    }
    await this.prisma.billingAuditLog.create({
      data: {
        entity: 'billing_order',
        entityKey: order.id,
        action: 'admin_confirm_bank',
        diff: {
          bankReference: ref,
          note: note?.trim() || null,
          payableVnd: totalPayable.toString(),
        },
        actorId: admin.id,
        actorEmail: admin.email ?? null,
      },
    });
    return { ...paid, note: finalNote };
  }

  async adminCancelOrder(
    admin: AuthenticatedUser,
    orderId: string,
    reason?: string,
  ): Promise<BillingOrderView> {
    const order = await this.prisma.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể huỷ đơn đang chờ thanh toán.');
    }
    const updated = await this.prisma.billingOrder.update({
      where: { id: order.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
        note: reason?.trim() || `Admin ${admin.email ?? admin.id} huỷ đơn`,
      },
    });
    await this.prisma.billingAuditLog.create({
      data: {
        entity: 'billing_order',
        entityKey: order.id,
        action: 'admin_cancel_order',
        diff: { reason: reason?.trim() || null },
        actorId: admin.id,
        actorEmail: admin.email ?? null,
      },
    });
    return this.mapOrder(updated);
  }
}
