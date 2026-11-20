import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@industriallink/contracts';
import type { CreateCtvCommissionPolicyRequest } from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import {
  CtvCommissionPolicyService,
  MIN_POLICY_LEAD_DAYS,
} from './ctv-commission-policy.service';

const SALES_USER: AuthenticatedUser = {
  id: 'user-sales-1',
  email: 'sale@example.com',
  role: UserRole.Sales,
  tenantId: 'tenant-1',
  displayName: 'Nguyễn Văn Sale',
  status: 'active',
};

const ADMIN_USER: AuthenticatedUser = {
  ...SALES_USER,
  id: 'user-admin',
  email: 'admin@example.com',
  role: UserRole.SuperAdmin,
};

const CTV_ID = 'partner-1';
const COMPANY_ID = 'company-1';
const ORDER_ID = 'order-1';

type TierRow = {
  code: string;
  name: string;
  minMonthlyRevenue: bigint;
  maxMonthlyRevenue: bigint | null;
  ratePercent: number;
  sortOrder: number;
};

type PolicyRow = {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED';
  effectiveFrom: Date;
  includeJobPosting: boolean;
  includeHuntPackage: boolean;
  includeCreditTopup: boolean;
  excludeVat: boolean;
  createdById: string;
  createdAt: Date;
  note: string | null;
  tiers: TierRow[];
};

type StatementRow = {
  id: string;
  ctvId: string;
  yearMonth: string;
  policyId: string;
  totalEligibleRevenue: bigint;
  achievedTierCode: string | null;
  achievedTierName: string | null;
  appliedRatePercent: number | null;
  grossCommission: bigint;
  adjustmentAmount: bigint;
  finalCommission: bigint;
  status: 'OPEN' | 'RECONCILED' | 'PAID';
  reconciledAt: Date | null;
  paidAt: Date | null;
};

type ItemRow = {
  id: string;
  statementId: string;
  ctvId: string;
  companyId: string;
  billingOrderId: string;
  productType: string;
  planCode: string | null;
  planName: string | null;
  paidAmountGross: bigint;
  vatAmount: bigint;
  discountAmount: bigint;
  eligibleRevenue: bigint;
  appliedRatePercent: number;
  commissionAmount: bigint;
  status: 'RECORDED' | 'VOIDED' | 'ADJUSTED_NEXT_PERIOD';
  yearMonth: string;
  paidAt: Date;
};

const TIERS: TierRow[] = [
  {
    code: 'BASIC',
    name: 'Cơ bản',
    minMonthlyRevenue: 0n,
    maxMonthlyRevenue: 10_000_000n,
    ratePercent: 15,
    sortOrder: 1,
  },
  {
    code: 'SILVER',
    name: 'Bạc',
    minMonthlyRevenue: 10_000_000n,
    maxMonthlyRevenue: 30_000_000n,
    ratePercent: 20,
    sortOrder: 2,
  },
  {
    code: 'GOLD',
    name: 'Vàng',
    minMonthlyRevenue: 30_000_000n,
    maxMonthlyRevenue: null,
    ratePercent: 25,
    sortOrder: 3,
  },
];

function makePolicy(overrides: Partial<PolicyRow> = {}): PolicyRow {
  return {
    id: 'policy-1',
    name: 'Chính sách hoa hồng CTV Inlink',
    version: 1,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    includeJobPosting: true,
    includeHuntPackage: true,
    includeCreditTopup: false,
    excludeVat: true,
    createdById: ADMIN_USER.id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    note: null,
    tiers: TIERS,
    ...overrides,
  };
}

/** Prisma giả — mô phỏng đủ các method service dùng. */
function makePrisma(options: { policies?: PolicyRow[] } = {}) {
  const policies = options.policies ?? [makePolicy()];
  const statements: StatementRow[] = [];
  const items: ItemRow[] = [];
  let itemSeq = 0;
  let statementSeq = 0;

  const prisma = {
    ctvCommissionPolicy: {
      findMany: jest.fn(async () => policies),
      findFirst: jest.fn(async () => policies[0] ?? null),
      findUnique: jest.fn(async () => policies[0] ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const tiers = (data.tiers as { create?: Array<Record<string, unknown>> })?.create ?? [];
        const row = makePolicy({
          ...(data as Partial<PolicyRow>),
          tiers: tiers.map((tier, index) => ({
            code: String(tier.code),
            name: String(tier.name),
            minMonthlyRevenue: tier.minMonthlyRevenue as bigint,
            maxMonthlyRevenue: (tier.maxMonthlyRevenue as bigint | null) ?? null,
            ratePercent: tier.ratePercent as number,
            sortOrder: index + 1,
          })),
        } as Partial<PolicyRow>);
        policies.push(row);
        return row;
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(policies[0], data);
        return policies[0];
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    ctvMonthlyStatement: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; ctvId_yearMonth?: { ctvId: string; yearMonth: string } } }) => {
        let found: StatementRow | undefined;
        if (where.id) {
          found = statements.find((row) => row.id === where.id);
        } else if (where.ctvId_yearMonth) {
          const key = where.ctvId_yearMonth;
          found = statements.find((row) => row.ctvId === key.ctvId && row.yearMonth === key.yearMonth);
        }
        if (!found) return null;
        // Quan hệ policy (tiers) dùng để tra bậc khi tính lại kỳ.
        const policy = policies.find((row) => row.id === found!.policyId) ?? policies[0];
        return { ...found, policy };
      }),
      create: jest.fn(async ({ data }: { data: Partial<StatementRow> }) => {
        statementSeq += 1;
        const row: StatementRow = {
          id: `statement-${statementSeq}`,
          ctvId: CTV_ID,
          yearMonth: '2026-11',
          policyId: 'policy-1',
          totalEligibleRevenue: 0n,
          achievedTierCode: null,
          achievedTierName: null,
          appliedRatePercent: null,
          grossCommission: 0n,
          adjustmentAmount: 0n,
          finalCommission: 0n,
          status: 'OPEN',
          reconciledAt: null,
          paidAt: null,
          ...data,
        };
        statements.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<StatementRow> }) => {
        const index = statements.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not found');
        const current = statements[index];
        // Hỗ trợ increment cho adjustmentAmount/finalCommission.
        const next = { ...current };
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as object)) {
            (next as Record<string, unknown>)[key] =
              (current as unknown as Record<string, bigint>)[key] +
              (value as unknown as { increment: bigint }).increment;
          } else {
            (next as unknown as Record<string, unknown>)[key] = value;
          }
        }
        statements[index] = next as StatementRow;
        return statements[index];
      }),
      findMany: jest.fn(async () => statements),
    },
    ctvCommissionItem: {
      findUnique: jest.fn(
        async ({ where }: { where: { billingOrderId_yearMonth?: { billingOrderId: string; yearMonth: string } } }) => {
          const key = where.billingOrderId_yearMonth;
          if (!key) return null;
          return (
            items.find(
              (row) =>
                row.billingOrderId === key.billingOrderId && row.yearMonth === key.yearMonth,
            ) ?? null
          );
        },
      ),
      findMany: jest.fn(async ({ where }: { where?: Partial<ItemRow> } = {}) => {
        if (!where) return items;
        return items.filter((row) => {
          if (where.ctvId && row.ctvId !== where.ctvId) return false;
          if (where.yearMonth && row.yearMonth !== where.yearMonth) return false;
          if (where.status && row.status !== where.status) return false;
          if (where.statementId && row.statementId !== where.statementId) return false;
          return true;
        });
      }),
      create: jest.fn(async ({ data }: { data: Partial<ItemRow> }) => {
        itemSeq += 1;
        const row: ItemRow = {
          id: `item-${itemSeq}`,
          statementId: 'statement-1',
          ctvId: CTV_ID,
          companyId: COMPANY_ID,
          billingOrderId: ORDER_ID,
          productType: 'HUNT_PACKAGE',
          planCode: null,
          planName: null,
          paidAmountGross: 0n,
          vatAmount: 0n,
          discountAmount: 0n,
          eligibleRevenue: 0n,
          appliedRatePercent: 0,
          commissionAmount: 0n,
          status: 'RECORDED',
          yearMonth: '2026-11',
          paidAt: new Date('2026-11-10T00:00:00.000Z'),
          ...data,
        };
        items.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ItemRow> }) => {
        const index = items.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not found');
        items[index] = { ...items[index], ...data };
        return items[index];
      }),
    },
    company: {
      findMany: jest.fn(async () => []),
    },
  };

  return { prisma, state: { policies, statements, items } };
}

function makeService() {
  const { prisma, state } = makePrisma();
  const service = new CtvCommissionPolicyService(prisma as never);
  return { service, prisma, state };
}

/** Ghi một đơn hợp lệ vào kỳ tháng của CTV. */
async function recordOrder(
  service: CtvCommissionPolicyService,
  prisma: ReturnType<typeof makePrisma>['prisma'],
  input: {
    billingOrderId: string;
    orderKind: string;
    eligibleRevenue: bigint;
    yearMonth: string;
    paidAt: Date;
  },
) {
  return service.recordEligibleTransaction(prisma as never, {
    ctvId: CTV_ID,
    companyId: COMPANY_ID,
    billingOrderId: input.billingOrderId,
    orderKind: input.orderKind,
    paidAmountGross: input.eligibleRevenue,
    eligibleRevenue: input.eligibleRevenue,
    paidAt: input.paidAt,
  });
}

describe('CtvCommissionPolicyService — quyền', () => {
  it('Sale chỉ xem, không sửa được chính sách', async () => {
    const { service } = makeService();
    expect(service.canEdit(SALES_USER)).toBe(false);
    await expect(
      service.createPolicy(SALES_USER, {} as CreateCtvCommissionPolicyRequest),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SuperAdmin được tạo phiên bản mới', async () => {
    const { service, prisma } = makeService();
    const future = new Date();
    future.setDate(future.getDate() + MIN_POLICY_LEAD_DAYS + 1);
    const effectiveFrom = future.toISOString().slice(0, 10);

    const result = await service.createPolicy(ADMIN_USER, {
      name: 'Chính sách hoa hồng CTV Inlink',
      effectiveFrom,
      tiers: [
        {
          code: 'BASIC',
          name: 'Cơ bản',
          minMonthlyRevenueVnd: '0',
          maxMonthlyRevenueVnd: '10000000',
          ratePercent: 15,
        },
        {
          code: 'SILVER',
          name: 'Bạc',
          minMonthlyRevenueVnd: '10000000',
          maxMonthlyRevenueVnd: '30000000',
          ratePercent: 20,
        },
        {
          code: 'GOLD',
          name: 'Vàng',
          minMonthlyRevenueVnd: '30000000',
          maxMonthlyRevenueVnd: null,
          ratePercent: 25,
        },
      ],
      includeJobPosting: true,
      includeHuntPackage: true,
      includeCreditTopup: false,
      excludeVat: true,
    });

    expect(result.version).toBe(2);
    // effectiveFrom ở tương lai → SCHEDULED (không ACTIVE ngay).
    expect(result.status).toBe('SCHEDULED');
    expect(prisma.ctvCommissionPolicy.create).toHaveBeenCalled();
  });

  it('từ chối ngày hiệu lực quá gần (dưới 30 ngày)', async () => {
    const { service } = makeService();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await expect(
      service.createPolicy(ADMIN_USER, {
        name: 'X',
        effectiveFrom: tomorrow.toISOString().slice(0, 10),
        tiers: [],
        includeJobPosting: true,
        includeHuntPackage: true,
        includeCreditTopup: false,
        excludeVat: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối bộ bậc không liên tục', async () => {
    const { service } = makeService();
    const future = new Date();
    future.setDate(future.getDate() + MIN_POLICY_LEAD_DAYS + 1);
    await expect(
      service.createPolicy(ADMIN_USER, {
        name: 'X',
        effectiveFrom: future.toISOString().slice(0, 10),
        tiers: [
          {
            code: 'BASIC',
            name: 'Cơ bản',
            minMonthlyRevenueVnd: '0',
            maxMonthlyRevenueVnd: '10000000',
            ratePercent: 15,
          },
          {
            code: 'SILVER',
            name: 'Bạc',
            minMonthlyRevenueVnd: '12000000',
            maxMonthlyRevenueVnd: null,
            ratePercent: 20,
          },
        ],
        includeJobPosting: true,
        includeHuntPackage: true,
        includeCreditTopup: false,
        excludeVat: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CtvCommissionPolicyService — ghi nhận & tính lại kỳ tháng', () => {
  it('Kịch bản 1: 3 đơn hợp lệ = 22tr → Bạc 20% → 4.400.000đ cho cả 3 đơn', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');

    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 9_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    await recordOrder(service, prisma, {
      billingOrderId: 'order-2',
      orderKind: 'platform',
      eligibleRevenue: 7_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    await recordOrder(service, prisma, {
      billingOrderId: 'order-3',
      orderKind: 'sourcing',
      eligibleRevenue: 6_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });

    const statement = state.statements[0];
    expect(statement.totalEligibleRevenue).toBe(22_000_000n);
    expect(statement.achievedTierCode).toBe('SILVER');
    expect(statement.achievedTierName).toBe('Bạc');
    expect(statement.appliedRatePercent).toBe(20);
    expect(statement.grossCommission).toBe(4_400_000n);
    expect(statement.finalCommission).toBe(4_400_000n);

    // Cả 3 đơn đều nhận tỷ lệ 20%.
    expect(state.items.map((item) => item.appliedRatePercent)).toEqual([20, 20, 20]);
    expect(state.items.map((item) => item.commissionAmount)).toEqual([
      1_800_000n,
      1_400_000n,
      1_200_000n,
    ]);
  });

  it('Kịch bản 2: nạp Credit bị loại hoàn toàn — không tạo item, không cộng doanh số', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');

    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 9_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    const creditItem = await recordOrder(service, prisma, {
      billingOrderId: 'order-credit',
      orderKind: 'topup',
      eligibleRevenue: 15_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });

    expect(creditItem).toBeNull();
    expect(state.items).toHaveLength(1);

    const statement = state.statements[0];
    expect(statement.totalEligibleRevenue).toBe(9_000_000n);
    expect(statement.achievedTierCode).toBe('BASIC');
    expect(statement.appliedRatePercent).toBe(15);
    expect(statement.grossCommission).toBe(1_350_000n);
  });

  it('Kịch bản 3: đạt >= 30tr → toàn bộ đơn nhảy lên Vàng 25%', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');

    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 15_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    await recordOrder(service, prisma, {
      billingOrderId: 'order-2',
      orderKind: 'platform',
      eligibleRevenue: 10_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    await recordOrder(service, prisma, {
      billingOrderId: 'order-3',
      orderKind: 'sourcing',
      eligibleRevenue: 8_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });

    const statement = state.statements[0];
    expect(statement.totalEligibleRevenue).toBe(33_000_000n);
    expect(statement.achievedTierCode).toBe('GOLD');
    expect(statement.appliedRatePercent).toBe(25);
    expect(statement.grossCommission).toBe(8_250_000n);
    expect(state.items.every((item) => item.appliedRatePercent === 25)).toBe(true);
  });

  it('Kịch bản 4: sang tháng mới bậc reset về Cơ bản, khách cũ mua lại vẫn ghi nhận', async () => {
    const { service, prisma, state } = makeService();

    await recordOrder(service, prisma, {
      billingOrderId: 'order-11',
      orderKind: 'sourcing',
      eligibleRevenue: 20_000_000n,
      yearMonth: '2026-11',
      paidAt: new Date('2026-11-20T00:00:00.000Z'),
    });
    expect(state.statements[0].achievedTierCode).toBe('SILVER');

    // Tháng 12 — cùng khách hàng mua lại gói.
    await recordOrder(service, prisma, {
      billingOrderId: 'order-12',
      orderKind: 'sourcing',
      eligibleRevenue: 5_000_000n,
      yearMonth: '2026-12',
      paidAt: new Date('2026-12-05T00:00:00.000Z'),
    });

    const dec = state.statements.find((row) => row.yearMonth === '2026-12');
    expect(dec).toBeDefined();
    expect(dec!.achievedTierCode).toBe('BASIC');
    expect(dec!.appliedRatePercent).toBe(15);
    expect(dec!.totalEligibleRevenue).toBe(5_000_000n);
    // Khoản của tháng 11 giữ nguyên — không bị tính lại ngược.
    expect(state.statements.find((row) => row.yearMonth === '2026-11')!.achievedTierCode).toBe(
      'SILVER',
    );
  });

  it('Kịch bản 5: gói 0đ không sinh hoa hồng', async () => {
    const { service, prisma, state } = makeService();
    const item = await recordOrder(service, prisma, {
      billingOrderId: 'order-free',
      orderKind: 'sourcing',
      eligibleRevenue: 0n,
      yearMonth: '2026-11',
      paidAt: new Date('2026-11-10T00:00:00.000Z'),
    });
    expect(item).toBeNull();
    expect(state.items).toHaveLength(0);
  });

  it('không ghi trùng cùng một đơn trong tháng', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');
    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 9_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    const second = await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 9_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    expect(second).toBeNull();
    expect(state.items).toHaveLength(1);
  });
});

describe('CtvCommissionPolicyService — hoàn tiền / hủy đơn', () => {
  it('Kịch bản 6a: hủy đơn trong kỳ OPEN → hạ doanh số, tính lại bậc', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');

    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 9_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    await recordOrder(service, prisma, {
      billingOrderId: 'order-2',
      orderKind: 'platform',
      eligibleRevenue: 15_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    expect(state.statements[0].achievedTierCode).toBe('SILVER');

    // Hủy đơn lớn → tụt xuống Cơ bản.
    await service.handleRefundOrCancel(prisma as never, {
      ctvId: CTV_ID,
      billingOrderId: 'order-2',
      yearMonth: '2026-11',
    });

    const statement = state.statements[0];
    expect(statement.totalEligibleRevenue).toBe(9_000_000n);
    expect(statement.achievedTierCode).toBe('BASIC');
    expect(statement.appliedRatePercent).toBe(15);
    expect(statement.grossCommission).toBe(1_350_000n);
    expect(state.items.find((item) => item.billingOrderId === 'order-2')!.status).toBe('VOIDED');
  });

  it('Kịch bản 6b: hủy đơn thuộc kỳ đã chốt → giữ kỳ cũ, tạo điều chỉnh âm ở kỳ hiện tại', async () => {
    const { service, prisma, state } = makeService();
    // Kỳ đã chốt nằm trong quá khứ so với tháng hiện tại (tháng 11/2026).
    const closedMonth = '2026-10';
    const paidAt = new Date('2026-10-10T00:00:00.000Z');

    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 20_000_000n,
      yearMonth: closedMonth,
      paidAt,
    });

    // Chốt kỳ 10.
    await service.recalculateCtvMonth(prisma as never, CTV_ID, closedMonth);
    const oct = state.statements.find((row) => row.yearMonth === closedMonth)!;
    oct.status = 'RECONCILED';
    oct.finalCommission = 4_000_000n;

    await service.handleRefundOrCancel(prisma as never, {
      ctvId: CTV_ID,
      billingOrderId: 'order-1',
      yearMonth: closedMonth,
    });

    // Kỳ 10 giữ nguyên — không sửa ngược lịch sử.
    expect(oct.totalEligibleRevenue).toBe(20_000_000n);
    expect(oct.grossCommission).toBe(4_000_000n);
    expect(oct.finalCommission).toBe(4_000_000n);
    expect(state.items.find((item) => item.billingOrderId === 'order-1')!.status).toBe(
      'ADJUSTED_NEXT_PERIOD',
    );

    // Kỳ hiện tại nhận điều chỉnh âm = -4.000.000đ.
    const current = state.statements.find((row) => row.status === 'OPEN' && row.adjustmentAmount !== 0n);
    expect(current).toBeDefined();
    expect(current!.adjustmentAmount).toBe(-4_000_000n);
    expect(current!.finalCommission).toBe(-4_000_000n);
  });

  it('không tính lại kỳ đã RECONCILED', async () => {
    const { service, prisma, state } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');
    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 20_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });
    state.statements[0].status = 'RECONCILED';
    state.statements[0].grossCommission = 4_000_000n;

    await service.recalculateCtvMonth(prisma as never, CTV_ID, '2026-11');
    expect(state.statements[0].grossCommission).toBe(4_000_000n);
    expect(state.statements[0].achievedTierCode).toBe('SILVER');
  });
});

describe('CtvCommissionPolicyService — bậc tháng & thanh tiến độ', () => {
  it('báo cáo bậc hiện tại + doanh số còn thiếu để lên hạng', async () => {
    const { service, prisma } = makeService();
    const paidAt = new Date('2026-11-10T00:00:00.000Z');
    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 22_000_000n,
      yearMonth: '2026-11',
      paidAt,
    });

    const tier = await service.monthlyTier(CTV_ID, '2026-11');
    expect(tier.totalEligibleRevenueVnd).toBe('22000000');
    expect(tier.achievedTierCode).toBe('SILVER');
    expect(tier.appliedRatePercent).toBe(20);
    expect(tier.nextTierCode).toBe('GOLD');
    expect(tier.nextTierRatePercent).toBe(25);
    expect(tier.revenueToNextTierVnd).toBe('8000000');
    expect(tier.estimatedCommissionVnd).toBe('4400000');
  });

  it('đã đạt bậc cao nhất thì không còn bậc kế tiếp', async () => {
    const { service, prisma } = makeService();
    await recordOrder(service, prisma, {
      billingOrderId: 'order-1',
      orderKind: 'sourcing',
      eligibleRevenue: 35_000_000n,
      yearMonth: '2026-11',
      paidAt: new Date('2026-11-10T00:00:00.000Z'),
    });
    const tier = await service.monthlyTier(CTV_ID, '2026-11');
    expect(tier.achievedTierCode).toBe('GOLD');
    expect(tier.nextTierCode).toBeNull();
    expect(tier.revenueToNextTierVnd).toBe('0');
  });
});

describe('CtvCommissionPolicyService — phạm vi sản phẩm', () => {
  it('nạp Credit bị loại khi includeCreditTopup = false', () => {
    const { service } = makeService();
    const policy = {
      includeJobPosting: true,
      includeHuntPackage: true,
      includeCreditTopup: false,
    };
    expect(service.productTypeForOrder(policy, 'topup')).toBeNull();
    expect(service.productTypeForOrder(policy, 'platform')).toBe('JOB_PACKAGE');
    expect(service.productTypeForOrder(policy, 'sourcing')).toBe('HUNT_PACKAGE');
  });

  it('nạp Credit được tính khi includeCreditTopup = true', () => {
    const { service } = makeService();
    expect(
      service.productTypeForOrder(
        {
          includeJobPosting: true,
          includeHuntPackage: true,
          includeCreditTopup: true,
        },
        'topup',
      ),
    ).toBe('CREDIT_TOPUP');
  });

  it('gói nằm ngoài phạm vi bị loại', () => {
    const { service } = makeService();
    expect(
      service.productTypeForOrder(
        {
          includeJobPosting: false,
          includeHuntPackage: false,
          includeCreditTopup: false,
        },
        'platform',
      ),
    ).toBeNull();
  });
});
