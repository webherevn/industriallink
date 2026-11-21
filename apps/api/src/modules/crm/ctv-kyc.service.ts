import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CrmKycProfileView,
  CrmKycReviewListView,
  CrmKycReviewResultView,
  CrmKycReviewRowView,
  CrmKycSide,
  CrmKycStatus,
  CrmKycUploadResult,
  ReviewCrmKycRequest,
  UpdateCrmKycRequest,
} from '@industriallink/contracts';
import { UserRole } from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { DEFAULT_TENANT_ID } from '../../shared/common/constants';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import {
  CTV_BANKS,
  TAX_LOCK_LIMIT,
  namesMatch,
  resolveTaxLockStatus,
  taxLockExpiry,
  validateKycSubmission,
} from './ctv-kyc';

/** Định dạng ảnh CCCD được chấp nhận. */
export const KYC_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Dung lượng tối đa mỗi ảnh CCCD (5MB). */
export const KYC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Prefix key lưu ảnh CCCD trong storage private. */
const KYC_KEY_PREFIX = 'ctv-kyc';

/** Thông báo chặn chi trả khi CTV chưa xác thực. */
export const PAYOUT_GATE_MESSAGE =
  'CTV chưa hoàn tất xác thực CCCD & tài khoản ngân hàng — số dư được bảo lưu sang kỳ chi trả tiếp theo';

type KycRow = {
  id: string;
  partnerId: string;
  status: CrmKycStatus;
  fullName: string | null;
  idNumber: string | null;
  idIssuedDate: Date | null;
  idIssuedPlace: string | null;
  personalTaxCode: string | null;
  phone: string | null;
  cccdFrontKey: string | null;
  cccdBackKey: string | null;
  bankCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycReviewedById: string | null;
  kycRejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PartnerRef = {
  id: string;
  name: string;
  code: string;
  phone: string;
  userId: string | null;
};

@Injectable()
export class CtvKycService {
  private readonly logger = new Logger(CtvKycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
  ) {}

  /** Danh sách ngân hàng cho dropdown frontend. */
  banks(): Array<{ code: string; name: string }> {
    return CTV_BANKS.map((bank) => ({ code: bank.code, name: bank.name }));
  }

  /** Hồ sơ KYC của chính CTV đang đăng nhập. Chưa đăng ký CTV thì trả hồ sơ rỗng. */
  async myProfile(actor: AuthenticatedUser): Promise<CrmKycProfileView> {
    const partner = await this.myPartner(actor);
    const row = await this.kycRow(partner.id);
    return this.mapProfile(row);
  }

  /**
   * Lưu hồ sơ xác thực. Cần đủ 2 ảnh CCCD + số CCCD 12 chữ số.
   * Hồ sơ đang PENDING thì khóa sửa. Hồ sơ VERIFIED cần confirmChange để sửa.
   */
  async submit(actor: AuthenticatedUser, input: UpdateCrmKycRequest): Promise<CrmKycProfileView> {
    const partner = await this.myPartner(actor);
    const existing = await this.kycRow(partner.id);

    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        'Hồ sơ đang chờ duyệt. Không thể tự sửa cho tới khi CRM Admin xử lý.',
      );
    }
    if (existing?.status === 'VERIFIED' && input.confirmChange !== true) {
      throw new BadRequestException(
        'Hồ sơ đã xác thực. Cần xác nhận thay đổi thông tin CCCD & ngân hàng.',
      );
    }

    const errors = validateKycSubmission({
      fullName: input.fullName,
      idNumber: input.idNumber,
      phone: input.phone,
      bankCode: input.bankCode,
      bankAccountNumber: input.bankAccountNumber,
      bankAccountHolder: input.bankAccountHolder,
      hasFrontImage: Boolean(existing?.cccdFrontKey),
      hasBackImage: Boolean(existing?.cccdBackKey),
    });
    if (errors.length > 0) {
      throw new BadRequestException(errors.join('. '));
    }

    // Số CCCD đã VERIFIED ở hồ sơ khác thì không cho trùng.
    const duplicate = await this.prisma.crmPartnerKyc.findFirst({
      where: {
        idNumber: input.idNumber.trim(),
        status: 'VERIFIED',
        partnerId: { not: partner.id },
      },
      select: { partnerId: true },
    });
    if (duplicate) {
      throw new BadRequestException('Số CCCD này đã được một hồ sơ khác xác thực.');
    }

    const fullName = input.fullName.trim();
    const holder = input.bankAccountHolder.trim();
    const data = {
      status: 'PENDING' as const,
      fullName,
      idNumber: input.idNumber.trim(),
      idIssuedDate: this.parseDate(input.idIssuedDate),
      idIssuedPlace: this.optional(input.idIssuedPlace),
      personalTaxCode: this.optional(input.personalTaxCode),
      phone: input.phone.trim(),
      bankCode: this.optional(input.bankCode),
      bankName: this.optional(input.bankName),
      bankAccountNumber: input.bankAccountNumber.trim(),
      bankAccountHolder: holder,
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycReviewedById: null,
      kycRejectReason: null,
    };

    const saved = existing
      ? await this.prisma.crmPartnerKyc.update({ where: { id: existing.id }, data })
      : await this.prisma.crmPartnerKyc.create({ data: { ...data, partnerId: partner.id } });

    if (existing?.status === 'VERIFIED') {
      // Hồ sơ đã xác thực mà sửa lại → báo SuperAdmin duyệt lại trước kỳ chi trả.
      await this.notifyReviewers(partner, 'Yêu cầu cập nhật lại thông tin xác thực CTV');
    }
    return this.mapProfile(saved);
  }

  /**
   * Upload 1 mặt ảnh CCCD. Lưu vào storage private với tên UUID, không lưu trong public.
   */
  async uploadImage(
    actor: AuthenticatedUser,
    side: CrmKycSide,
    file: Express.Multer.File | undefined,
  ): Promise<CrmKycUploadResult> {
    const partner = await this.myPartner(actor);
    if (!file) throw new BadRequestException('Không có ảnh được tải lên');
    if (!KYC_IMAGE_MIME_TYPES.includes(file.mimetype as (typeof KYC_IMAGE_MIME_TYPES)[number])) {
      throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WEBP');
    }
    if (file.size > KYC_MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh vượt quá 5MB');
    }

    const existing = await this.kycRow(partner.id);
    if (existing?.status === 'PENDING') {
      throw new BadRequestException(
        'Hồ sơ đang chờ duyệt. Không thể tải ảnh mới cho tới khi CRM Admin xử lý.',
      );
    }

    const ext = this.extensionFor(file.mimetype);
    const key = `${KYC_KEY_PREFIX}/${partner.id}/${randomUUID()}.${ext}`;
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const now = new Date();
    // Nếu hồ sơ đã VERIFIED mà CTV tải ảnh CCCD mới → chuyển về UNVERIFIED để tải đủ 2 mặt rồi gửi duyệt lại (PENDING).
    const nextStatus =
      existing?.status === 'VERIFIED'
        ? ('UNVERIFIED' as const)
        : (existing?.status ?? ('UNVERIFIED' as const));
    const patch =
      side === 'front'
        ? { cccdFrontKey: key, status: nextStatus }
        : { cccdBackKey: key, status: nextStatus };

    const saved = existing
      ? await this.prisma.crmPartnerKyc.update({ where: { id: existing.id }, data: patch })
      : await this.prisma.crmPartnerKyc.create({
          data: { partnerId: partner.id, ...patch, status: 'UNVERIFIED' },
        });

    return { side, key, uploadedAt: now.toISOString() };
  }

  /**
   * Stream ảnh CCCD. Chỉ chính chủ CTV hoặc tài khoản CRM quản trị mới xem được.
   */
  async readImage(
    actor: AuthenticatedUser,
    partnerId: string,
    side: CrmKycSide,
  ): Promise<{ buffer: Buffer; mime: string }> {
    if (!this.canReview(actor)) {
      // Không phải kế toán → chỉ được xem hồ sơ của chính mình.
      const partner = await this.myPartner(actor);
      if (partner.id !== partnerId) {
        throw new ForbiddenException('Không được xem ảnh CCCD của cộng tác viên khác');
      }
    }

    const row = await this.prisma.crmPartnerKyc.findUnique({
      where: { partnerId },
      select: { cccdFrontKey: true, cccdBackKey: true },
    });
    if (!row) throw new NotFoundException('Không có hồ sơ xác thực');

    const key = side === 'front' ? row.cccdFrontKey : row.cccdBackKey;
    if (!key) throw new NotFoundException(`Chưa có ảnh mặt ${side === 'front' ? 'trước' : 'sau'}`);

    const buffer = await this.storage.getObject(key);
    return { buffer, mime: this.mimeForKey(key) };
  }

  /** Danh sách hồ sơ KYC cho CRM Admin duyệt. */
  async reviewList(
    actor: AuthenticatedUser,
    filters: { status?: string; query?: string },
  ): Promise<CrmKycReviewListView> {
    if (!this.canReview(actor)) throw new ForbiddenException('Không có quyền xem hồ sơ xác thực');

    const status = filters.status?.trim().toUpperCase();
    const validStatus: CrmKycStatus[] = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];
    const where: Record<string, unknown> = {};
    if (status && validStatus.includes(status as CrmKycStatus)) {
      where.status = status;
    }

    const rows = await this.prisma.crmPartnerKyc.findMany({
      where,
      orderBy: [{ status: 'asc' }, { kycSubmittedAt: 'desc' }],
      take: 500,
      include: {
        partner: { select: { id: true, name: true, code: true, phone: true } },
      },
    });

    const query = (filters.query ?? '').trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => {
          const hay = [
            row.partner.name,
            row.partner.code,
            row.partner.phone,
            row.fullName,
            row.idNumber,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(query);
        })
      : rows;

    const pendingCount = await this.prisma.crmPartnerKyc.count({ where: { status: 'PENDING' } });

    return {
      rows: filtered.map((row) => this.mapReviewRow(row)),
      pendingCount,
    };
  }

  /** Duyệt hoặc từ chối một hồ sơ KYC. */
  async review(
    actor: AuthenticatedUser,
    partnerId: string,
    input: ReviewCrmKycRequest,
  ): Promise<CrmKycReviewResultView> {
    if (!this.canReview(actor)) {
      throw new ForbiddenException('Chỉ SuperAdmin hoặc trưởng phòng kinh doanh duyệt xác thực');
    }
    const row = await this.prisma.crmPartnerKyc.findUnique({ where: { partnerId } });
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ xác thực');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Hồ sơ này không ở trạng thái chờ duyệt');
    }

    if (input.action !== 'APPROVE' && input.action !== 'REJECT') {
      throw new BadRequestException('Hành động duyệt KYC không hợp lệ (chỉ nhận APPROVE hoặc REJECT)');
    }

    if (input.action === 'REJECT') {
      const reason = input.rejectReason?.trim();
      if (!reason) throw new BadRequestException('Cần nhập lý do từ chối');
      const saved = await this.prisma.crmPartnerKyc.update({
        where: { id: row.id },
        data: {
          status: 'REJECTED',
          kycReviewedAt: new Date(),
          kycReviewedById: actor.id,
          kycRejectReason: reason,
        },
      });
      await this.notifyPartner(row.partnerId, 'Xác thực CCCD bị từ chối', reason, '/ctv/kyc');
      return {
        partnerId: saved.partnerId,
        status: saved.status,
        kycReviewedAt: saved.kycReviewedAt?.toISOString() ?? null,
        kycRejectReason: saved.kycRejectReason,
      };
    }

    // Duyệt: số CCCD phải hợp lệ và không trùng hồ sơ VERIFIED khác.
    if (!row.idNumber || !/^\d{12}$/.test(row.idNumber)) {
      throw new BadRequestException('Hồ sơ chưa có số CCCD 12 chữ số hợp lệ');
    }
    const duplicate = await this.prisma.crmPartnerKyc.findFirst({
      where: {
        idNumber: row.idNumber,
        status: 'VERIFIED',
        partnerId: { not: row.partnerId },
      },
      select: { partnerId: true },
    });
    if (duplicate) throw new BadRequestException('Số CCCD đã được một hồ sơ khác xác thực');

    const saved = await this.prisma.crmPartnerKyc.update({
      where: { id: row.id },
      data: {
        status: 'VERIFIED',
        kycReviewedAt: new Date(),
        kycReviewedById: actor.id,
        kycRejectReason: null,
      },
    });
    await this.notifyPartner(
      row.partnerId,
      'Xác thực CCCD đã được duyệt',
      'Hồ sơ của bạn đã được duyệt. Bạn có thể nhận hoa hồng từ kỳ chi trả tiếp theo.',
      '/ctv/kyc',
    );
    return {
      partnerId: saved.partnerId,
      status: saved.status,
      kycReviewedAt: saved.kycReviewedAt?.toISOString() ?? null,
      kycRejectReason: null,
    };
  }

  /**
   * Chặn chi trả khi CTV chưa xác thực.
   * Trả về lỗi 400 nếu chưa VERIFIED hoặc thiếu thông tin ngân hàng.
   */
  async assertPayoutAllowed(partnerId: string): Promise<void> {
    const row = await this.prisma.crmPartnerKyc.findUnique({
      where: { partnerId },
      select: {
        status: true,
        bankAccountNumber: true,
        bankAccountHolder: true,
        bankCode: true,
      },
    });
    if (!row || row.status !== 'VERIFIED') {
      throw new BadRequestException(PAYOUT_GATE_MESSAGE);
    }
    if (!row.bankAccountNumber || !row.bankAccountHolder || !row.bankCode) {
      throw new BadRequestException(PAYOUT_GATE_MESSAGE);
    }
  }

  /** Trạng thái KYC của một CTV (dùng trong bảng kỳ chi trả CRM). */
  async statusOf(partnerId: string): Promise<CrmKycStatus> {
    const row = await this.prisma.crmPartnerKyc.findUnique({
      where: { partnerId },
      select: { status: true },
    });
    return row?.status ?? 'UNVERIFIED';
  }

  /**
   * Số khóa MST đang hiệu lực của một CTV.
   * Chỉ tính mã còn trong hạn bảo vệ hoặc đã đăng ký / đã có đơn.
   */
  async activeTaxLockCount(partnerId: string): Promise<number> {
    const now = new Date();
    const rows = await this.prisma.crmPartnerClaim.findMany({
      where: { partnerId },
      select: { status: true, expiresAt: true },
    });
    return rows.filter(
      (row) => resolveTaxLockStatus(row.status, row.expiresAt, now) !== 'EXPIRED',
    ).length;
  }

  /** Chặn khóa MST khi đã đủ 30 mã đang hiệu lực. */
  async assertTaxLockSlot(partnerId: string): Promise<void> {
    const active = await this.activeTaxLockCount(partnerId);
    if (active >= TAX_LOCK_LIMIT) {
      throw new BadRequestException(
        `Đã khóa đủ ${TAX_LOCK_LIMIT} mã số thuế. Mã cũ hết hạn sẽ tự nhả.`,
      );
    }
  }

  /** Gia hạn bảo vệ MST khi khóa mới. */
  taxLockExpiryFrom(now: Date = new Date()): Date {
    return taxLockExpiry(now);
  }

  /** true khi tài khoản được quyền duyệt / xem hồ sơ xác thực. */
  canReview(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin || actor.role === UserRole.SalesManager;
  }

  private async myPartner(actor: AuthenticatedUser): Promise<PartnerRef> {
    const partner = await this.prisma.crmPartner.findUnique({
      where: { userId: actor.id },
      select: { id: true, name: true, code: true, phone: true, userId: true },
    });
    if (!partner) {
      throw new BadRequestException('Đăng ký cộng tác viên trước khi xác thực CCCD');
    }
    return partner;
  }

  private async kycRow(partnerId: string): Promise<KycRow | null> {
    return this.prisma.crmPartnerKyc.findUnique({ where: { partnerId } });
  }

  private mapProfile(row: KycRow | null): CrmKycProfileView {
    if (!row) {
      return {
        status: 'UNVERIFIED',
        fullName: null,
        idNumber: null,
        idIssuedDate: null,
        idIssuedPlace: null,
        personalTaxCode: null,
        phone: null,
        hasFrontImage: false,
        hasBackImage: false,
        bankCode: null,
        bankName: null,
        bankAccountNumber: null,
        bankAccountHolder: null,
        kycSubmittedAt: null,
        kycReviewedAt: null,
        kycRejectReason: null,
        resubmitRequested: false,
        updatedAt: new Date(0).toISOString(),
      };
    }
    return {
      status: row.status,
      fullName: row.fullName,
      idNumber: row.idNumber,
      idIssuedDate: row.idIssuedDate?.toISOString() ?? null,
      idIssuedPlace: row.idIssuedPlace,
      personalTaxCode: row.personalTaxCode,
      phone: row.phone,
      hasFrontImage: Boolean(row.cccdFrontKey),
      hasBackImage: Boolean(row.cccdBackKey),
      bankCode: row.bankCode,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountHolder: row.bankAccountHolder,
      kycSubmittedAt: row.kycSubmittedAt?.toISOString() ?? null,
      kycReviewedAt: row.kycReviewedAt?.toISOString() ?? null,
      kycRejectReason: row.kycRejectReason,
      resubmitRequested: row.status === 'VERIFIED',
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapReviewRow(
    row: KycRow & { partner: { id: string; name: string; code: string; phone: string } },
  ): CrmKycReviewRowView {
    return {
      partnerId: row.partnerId,
      partnerName: row.partner.name,
      partnerCode: row.partner.code,
      partnerPhone: row.partner.phone,
      status: row.status,
      fullName: row.fullName,
      idNumber: row.idNumber,
      idIssuedDate: row.idIssuedDate?.toISOString() ?? null,
      idIssuedPlace: row.idIssuedPlace,
      personalTaxCode: row.personalTaxCode,
      phone: row.phone,
      hasFrontImage: Boolean(row.cccdFrontKey),
      hasBackImage: Boolean(row.cccdBackKey),
      bankCode: row.bankCode,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountHolder: row.bankAccountHolder,
      holderMismatch: !namesMatch(row.fullName, row.bankAccountHolder),
      kycSubmittedAt: row.kycSubmittedAt?.toISOString() ?? null,
      kycReviewedAt: row.kycReviewedAt?.toISOString() ?? null,
      kycRejectReason: row.kycRejectReason,
    };
  }

  private async notifyPartner(
    partnerId: string,
    title: string,
    body: string,
    link: string,
  ): Promise<void> {
    const partner = await this.prisma.crmPartner.findUnique({
      where: { id: partnerId },
      select: { userId: true },
    });
    if (!partner?.userId) return;
    try {
      await this.notifications.createInApp({
        tenantId: DEFAULT_TENANT_ID,
        userId: partner.userId,
        type: 'crm.ctv_kyc',
        title,
        body,
        link,
        entityType: 'crm.partner',
        entityId: partnerId,
      });
    } catch (err) {
      this.logger.warn(`Không gửi được thông báo KYC cho ${partnerId}: ${String(err)}`);
    }
  }

  private async notifyReviewers(partner: PartnerRef, title: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.SuperAdmin, UserRole.SalesManager] } },
      select: { id: true },
      take: 20,
    });
    for (const admin of admins) {
      try {
        await this.notifications.createInApp({
          tenantId: DEFAULT_TENANT_ID,
          userId: admin.id,
          type: 'crm.ctv_kyc',
          title,
          body: `CTV ${partner.name} (${partner.code}) cần duyệt lại hồ sơ xác thực.`,
          link: `/crm/partners/${partner.id}`,
          entityType: 'crm.partner',
          entityId: partner.id,
        });
      } catch (err) {
        this.logger.warn(`Không gửi được thông báo duyệt KYC: ${String(err)}`);
      }
    }
  }

  private optional(raw: string | null | undefined): string | null {
    const value = raw?.trim();
    return value ? value : null;
  }

  private parseDate(raw: string | null | undefined): Date | null {
    if (!raw?.trim()) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private extensionFor(mime: string): string {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private mimeForKey(key: string): string {
    if (key.endsWith('.png')) return 'image/png';
    if (key.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
