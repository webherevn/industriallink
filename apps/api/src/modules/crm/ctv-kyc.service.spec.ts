import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@industriallink/contracts';
import type { UpdateCrmKycRequest } from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CtvKycService, PAYOUT_GATE_MESSAGE } from './ctv-kyc.service';

/** Tài khoản CTV đã đăng ký. */
const CTV_USER: AuthenticatedUser = {
  id: 'user-ctv-1',
  email: 'ctv@example.com',
  role: UserRole.Recruiter,
  tenantId: 'tenant-1',
  displayName: 'Nguyễn Văn A',
  status: 'active',
};

/** Tài khoản CTV khác — không được xem ảnh của người thứ nhất. */
const OTHER_CTV_USER: AuthenticatedUser = {
  ...CTV_USER,
  id: 'user-ctv-2',
  email: 'ctv2@example.com',
};

const ADMIN_USER: AuthenticatedUser = {
  ...CTV_USER,
  id: 'user-admin',
  email: 'admin@example.com',
  role: UserRole.SuperAdmin,
};

const PARTNER_ID = 'partner-1';
const OTHER_PARTNER_ID = 'partner-2';

/** Payload hồ sơ hợp lệ, dùng chung cho các test nộp hồ sơ. */
function validSubmission(overrides: Partial<UpdateCrmKycRequest> = {}): UpdateCrmKycRequest {
  return {
    fullName: 'Nguyễn Văn A',
    idNumber: '012345678901',
    phone: '0900000001',
    bankCode: 'MB',
    bankName: 'MB Bank',
    bankAccountNumber: '0123456789',
    bankAccountHolder: 'Nguyễn Văn A',
    ...overrides,
  };
}

type KycDbRow = {
  id: string;
  partnerId: string;
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
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

function makeRow(overrides: Partial<KycDbRow> = {}): KycDbRow {
  return {
    id: 'kyc-1',
    partnerId: PARTNER_ID,
    status: 'UNVERIFIED',
    fullName: null,
    idNumber: null,
    idIssuedDate: null,
    idIssuedPlace: null,
    personalTaxCode: null,
    phone: null,
    cccdFrontKey: null,
    cccdBackKey: null,
    bankCode: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountHolder: null,
    kycSubmittedAt: null,
    kycReviewedAt: null,
    kycReviewedById: null,
    kycRejectReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** Prisma giả: chỉ cần các method mà CtvKycService gọi. */
function makePrisma(options: {
  partnerByUserId?: Record<string, { id: string; name: string; code: string; phone: string; userId: string }>;
  kycRows?: KycDbRow[];
} = {}) {
  const partners = options.partnerByUserId ?? {
    [CTV_USER.id]: {
      id: PARTNER_ID,
      name: 'Nguyễn Văn A',
      code: 'CTV0001',
      phone: '0900000001',
      userId: CTV_USER.id,
    },
    [OTHER_CTV_USER.id]: {
      id: OTHER_PARTNER_ID,
      name: 'Trần Văn B',
      code: 'CTV0002',
      phone: '0900000002',
      userId: OTHER_CTV_USER.id,
    },
  };
  const rows = options.kycRows ?? [];
  const state = { rows: [...rows] };

  const prisma = {
    crmPartner: {
      findUnique: jest.fn(async ({ where }: { where: { userId?: string; id?: string } }) => {
        if (where.userId) return partners[where.userId] ?? null;
        return Object.values(partners).find((p) => p.id === where.id) ?? null;
      }),
    },
    crmPartnerKyc: {
      findUnique: jest.fn(async ({ where }: { where: { partnerId?: string } }) => {
        if (!where.partnerId) return null;
        return state.rows.find((row) => row.partnerId === where.partnerId) ?? null;
      }),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => state.rows),
      count: jest.fn(async () => state.rows.filter((row) => row.status === 'PENDING').length),
      create: jest.fn(async ({ data }: { data: Partial<KycDbRow> }) => {
        const row = makeRow({ ...data, id: 'kyc-new' } as Partial<KycDbRow>);
        state.rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<KycDbRow> }) => {
        const index = state.rows.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not found');
        state.rows[index] = { ...state.rows[index], ...data };
        return state.rows[index];
      }),
    },
    crmPartnerClaim: {
      findMany: jest.fn(async () => [] as Array<{ status: string; expiresAt: Date | null }>),
    },
    user: {
      findMany: jest.fn(async () => [] as Array<{ id: string }>),
    },
  };

  return { prisma, state };
}

function makeService(prisma: unknown) {
  const storage = {
    putObject: jest.fn(async () => undefined),
    getObject: jest.fn(async () => Buffer.from('img')),
  };
  const notifications = {
    createInApp: jest.fn(async () => undefined),
  };
  const service = new CtvKycService(
    prisma as never,
    storage as never,
    notifications as never,
  );
  return { service, storage, notifications };
}

describe('quyền xem ảnh CCCD', () => {
  it('chính chủ được xem ảnh của mình', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, cccdFrontKey: 'ctv-kyc/partner-1/a.jpg' }),
      ],
    });
    const { service } = makeService(prisma);
    const result = await service.readImage(CTV_USER, PARTNER_ID, 'front');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('CTV khác bị chặn khi xem ảnh của CTV khác', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, cccdFrontKey: 'ctv-kyc/partner-1/a.jpg' }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(service.readImage(OTHER_CTV_USER, PARTNER_ID, 'front')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('SuperAdmin được xem ảnh của mọi CTV', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, cccdFrontKey: 'ctv-kyc/partner-1/a.jpg' }),
      ],
    });
    const { service } = makeService(prisma);
    const result = await service.readImage(ADMIN_USER, PARTNER_ID, 'front');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('báo 404 khi chưa có ảnh mặt sau', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, cccdFrontKey: 'ctv-kyc/partner-1/a.jpg' }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(service.readImage(CTV_USER, PARTNER_ID, 'back')).rejects.toThrow(
      /Chưa có ảnh mặt sau/,
    );
  });
});

describe('nộp hồ sơ KYC', () => {
  it('thiếu ảnh mặt sau thì bị chặn 400', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, cccdFrontKey: 'ctv-kyc/partner-1/a.jpg' }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(
      service.submit(CTV_USER, validSubmission()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('số CCCD không đủ 12 chữ số thì bị chặn 400', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          cccdFrontKey: 'ctv-kyc/partner-1/a.jpg',
          cccdBackKey: 'ctv-kyc/partner-1/b.jpg',
        }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(
      service.submit(CTV_USER, validSubmission({ idNumber: '01234567890' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hồ sơ hợp lệ thì chuyển sang PENDING', async () => {
    const { prisma, state } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          cccdFrontKey: 'ctv-kyc/partner-1/a.jpg',
          cccdBackKey: 'ctv-kyc/partner-1/b.jpg',
        }),
      ],
    });
    const { service } = makeService(prisma);
    const result = await service.submit(CTV_USER, validSubmission());
    expect(result.status).toBe('PENDING');
    expect(state.rows[0].status).toBe('PENDING');
  });

  it('hồ sơ đang chờ duyệt thì không tự sửa được', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          status: 'PENDING',
          cccdFrontKey: 'ctv-kyc/partner-1/a.jpg',
          cccdBackKey: 'ctv-kyc/partner-1/b.jpg',
        }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(
      service.submit(CTV_USER, validSubmission()),
    ).rejects.toThrow(/đang chờ duyệt/i);
  });

  it('hồ sơ đã xác thực thì cần cờ xác nhận mới sửa được', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          status: 'VERIFIED',
          cccdFrontKey: 'ctv-kyc/partner-1/a.jpg',
          cccdBackKey: 'ctv-kyc/partner-1/b.jpg',
        }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(
      service.submit(CTV_USER, validSubmission()),
    ).rejects.toThrow(/xác nhận thay đổi/i);
  });

  it('hồ sơ đã xác thực + confirm thì quay lại PENDING', async () => {
    const { prisma, state } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          status: 'VERIFIED',
          cccdFrontKey: 'ctv-kyc/partner-1/a.jpg',
          cccdBackKey: 'ctv-kyc/partner-1/b.jpg',
        }),
      ],
    });
    const { service } = makeService(prisma);
    const result = await service.submit(CTV_USER, validSubmission({ confirmChange: true }));
    expect(result.status).toBe('PENDING');
    expect(state.rows[0].status).toBe('PENDING');
  });
});

describe('duyệt KYC', () => {
  it('từ chối mà không có lý do thì bị chặn', async () => {
    const { prisma } = makePrisma({
      kycRows: [makeRow({ partnerId: PARTNER_ID, status: 'PENDING', idNumber: '012345678901' })],
    });
    const { service } = makeService(prisma);
    await expect(
      service.review(ADMIN_USER, PARTNER_ID, { action: 'REJECT' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tài khoản không có quyền không duyệt được', async () => {
    const { prisma } = makePrisma({
      kycRows: [makeRow({ partnerId: PARTNER_ID, status: 'PENDING', idNumber: '012345678901' })],
    });
    const { service } = makeService(prisma);
    await expect(
      service.review(CTV_USER, PARTNER_ID, { action: 'APPROVE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('duyệt thành công thì trạng thái thành VERIFIED', async () => {
    const { prisma, state } = makePrisma({
      kycRows: [makeRow({ partnerId: PARTNER_ID, status: 'PENDING', idNumber: '012345678901' })],
    });
    const { service } = makeService(prisma);
    const result = await service.review(ADMIN_USER, PARTNER_ID, { action: 'APPROVE' });
    expect(result.status).toBe('VERIFIED');
    expect(state.rows[0].status).toBe('VERIFIED');
  });
});

describe('cổng chi trả (Payout Gate)', () => {
  it('chặn khi CTV chưa xác thực', async () => {
    const { prisma } = makePrisma({
      kycRows: [makeRow({ partnerId: PARTNER_ID, status: 'UNVERIFIED' })],
    });
    const { service } = makeService(prisma);
    await expect(service.assertPayoutAllowed(PARTNER_ID)).rejects.toThrow(PAYOUT_GATE_MESSAGE);
  });

  it('chặn khi hồ sơ đang chờ duyệt', async () => {
    const { prisma } = makePrisma({
      kycRows: [makeRow({ partnerId: PARTNER_ID, status: 'PENDING' })],
    });
    const { service } = makeService(prisma);
    await expect(service.assertPayoutAllowed(PARTNER_ID)).rejects.toThrow(PAYOUT_GATE_MESSAGE);
  });

  it('chặn khi đã xác thực nhưng thiếu tài khoản ngân hàng', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({ partnerId: PARTNER_ID, status: 'VERIFIED', bankCode: null, bankAccountNumber: null }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(service.assertPayoutAllowed(PARTNER_ID)).rejects.toThrow(PAYOUT_GATE_MESSAGE);
  });

  it('cho qua khi đã xác thực và đủ thông tin ngân hàng', async () => {
    const { prisma } = makePrisma({
      kycRows: [
        makeRow({
          partnerId: PARTNER_ID,
          status: 'VERIFIED',
          bankCode: 'MB',
          bankAccountNumber: '0123456789',
          bankAccountHolder: 'Nguyễn Văn A',
        }),
      ],
    });
    const { service } = makeService(prisma);
    await expect(service.assertPayoutAllowed(PARTNER_ID)).resolves.toBeUndefined();
  });
});

describe('giới hạn khóa MST', () => {
  it('chặn khi đã khóa đủ 30 mã còn hiệu lực', async () => {
    const { prisma } = makePrisma();
    const rows = Array.from({ length: 30 }, (_, index) => ({
      status: 'PROTECTING',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      taxCode: `0100${String(index).padStart(6, '0')}`,
    }));
    (prisma.crmPartnerClaim.findMany as jest.Mock).mockResolvedValue(rows);
    const { service } = makeService(prisma);
    await expect(service.assertTaxLockSlot(PARTNER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cho khóa thêm khi còn dưới 30 mã hiệu lực', async () => {
    const { prisma } = makePrisma();
    const rows = Array.from({ length: 29 }, (_, index) => ({
      status: 'PROTECTING',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      taxCode: `0100${String(index).padStart(6, '0')}`,
    }));
    (prisma.crmPartnerClaim.findMany as jest.Mock).mockResolvedValue(rows);
    const { service } = makeService(prisma);
    await expect(service.assertTaxLockSlot(PARTNER_ID)).resolves.toBeUndefined();
  });

  it('không tính mã đã hết hạn', async () => {
    const { prisma } = makePrisma();
    const rows = Array.from({ length: 30 }, () => ({
      status: 'PROTECTING',
      expiresAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      taxCode: '0100000001',
    }));
    (prisma.crmPartnerClaim.findMany as jest.Mock).mockResolvedValue(rows);
    const { service } = makeService(prisma);
    await expect(service.assertTaxLockSlot(PARTNER_ID)).resolves.toBeUndefined();
  });
});
