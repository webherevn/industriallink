/**
 * Unit test cho BillingOverviewService — tổng quan Gói dịch vụ & Ví Credit.
 *
 * Mục tiêu chính: đảm bảo trang billing hub đọc đúng nguồn sự thật
 * (`BillingJobPackage` + `BillingHuntPackage` + `billing_credit_account`)
 * và KHÔNG dùng số cộng dồn legacy từ `BillingCompanySourcingPlan`.
 */
import { BillingOverviewService } from './billing-overview.service';

type Row = Record<string, unknown>;

/** Gói tin đăng mẫu. */
function jobRow(overrides: Row = {}): Row {
  return {
    id: 'job-pkg-1',
    code: 'JD-ST-000001',
    orderId: null,
    planId: 'plan-1',
    packageType: 'STANDARD',
    packageName: 'TIN ĐĂNG TIÊU CHUẨN',
    status: 'ACTIVE',
    durationDays: 30,
    purchasedAt: new Date('2026-11-01T00:00:00Z'),
    activatedAt: new Date('2026-11-05T00:00:00Z'),
    expiresAt: new Date('2026-12-05T00:00:00Z'),
    activationDeadlineAt: new Date('2026-12-01T00:00:00Z'),
    totalJobs: 4,
    usedJobs: 1,
    creditsIncluded: 30,
    creditsGranted: true,
    priceVnd: 1000000,
    plan: { code: 'TIN_DANG', name: 'Tin đăng' },
    order: null,
    ...overrides,
  };
}

/** Gói Săn mẫu. */
function huntRow(overrides: Row = {}): Row {
  return {
    id: 'hunt-pkg-1',
    code: 'TS-000101',
    planId: 'plan-2',
    orderId: null,
    packageType: 'DEEP',
    packageName: 'TIN SĂN CHUYÊN SÂU',
    status: 'ACTIVE',
    durationDays: 30,
    purchasedAt: new Date('2026-11-10T00:00:00Z'),
    activatedAt: new Date('2026-11-19T00:00:00Z'),
    expiresAt: new Date('2026-12-19T00:00:00Z'),
    activationDeadlineAt: new Date('2026-12-10T00:00:00Z'),
    creditsIncluded: 50,
    creditsGranted: true,
    totalCriteriaEdits: 30,
    usedCriteriaEdits: 0,
    totalReports: 4,
    usedReports: 0,
    totalHandovers: 15,
    usedHandovers: 0,
    plan: { code: 'SAN_CHUYEN_SAU', name: 'Săn Chuyên sâu' },
    campaign: { id: 'camp-1', title: 'Tuyển dev' },
    ...overrides,
  };
}

function makePrisma(overrides: {
  jobPackages?: Row[];
  huntPackages?: Row[];
  account?: Row | null;
  lots?: Row[];
} = {}) {
  const jobPackages = overrides.jobPackages ?? [];
  const huntPackages = overrides.huntPackages ?? [];
  const account =
    'account' in overrides
      ? overrides.account
      : { balance: 164, lifetimeGranted: 302, lifetimeConsumed: 138 };
  const lots = overrides.lots ?? [];

  return {
    billingJobPackage: { findMany: jest.fn().mockResolvedValue(jobPackages) },
    billingHuntPackage: { findMany: jest.fn().mockResolvedValue(huntPackages) },
    billingCreditAccount: {
      findUnique: jest.fn().mockResolvedValue(account),
    },
    billingCreditLot: { findFirst: jest.fn().mockResolvedValue(lots[0] ?? null) },
  } as never;
}

describe('BillingOverviewService', () => {
  const future = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const past = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  it('trả về gói tin đăng ACTIVE và gói Săn ACTIVE riêng biệt', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        jobPackages: [jobRow()],
        huntPackages: [huntRow()],
      }),
    );

    const result = await service.getOverview('company-1');

    expect(result.activeJobPackages).toHaveLength(1);
    expect(result.activeHuntPackages).toHaveLength(1);
    // Mỗi gói Săn là 1 card độc lập — KHÔNG gộp vào 1 card chung.
    expect(result.activeHuntPackages[0].code).toBe('TS-000101');
    expect(result.activeHuntPackages[0].packageName).toBe('TIN SĂN CHUYÊN SÂU');
    expect(result.activeHuntPackages[0].creditsIncluded).toBe(50);
    expect(result.activeHuntPackages[0].totalHandovers).toBe(15);
  });

  it('hiển thị 2 gói Săn ACTIVE thành 2 card riêng biệt', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        huntPackages: [
          huntRow({
            id: 'hunt-pkg-1',
            code: 'TS-000101',
            packageType: 'DEEP',
            packageName: 'TIN SĂN CHUYÊN SÂU',
            expiresAt: new Date('2026-12-20T00:00:00Z'),
          }),
          huntRow({
            id: 'hunt-pkg-2',
            code: 'TS-000102',
            packageType: 'STANDARD',
            packageName: 'TIN SĂN TIÊU CHUẨN',
            creditsIncluded: 30,
            totalCriteriaEdits: 4,
            totalReports: 4,
            totalHandovers: 0,
            expiresAt: new Date('2026-12-19T00:00:00Z'),
            campaign: { id: 'camp-2', title: 'Tuyển sales' },
          }),
        ],
      }),
    );

    const result = await service.getOverview('company-1');

    expect(result.activeHuntPackages).toHaveLength(2);
    expect(result.activeHuntPackages.map((p) => p.code)).toEqual([
      'TS-000101',
      'TS-000102',
    ]);
    // Gói STANDARD không có bàn giao Inlink.
    expect(result.activeHuntPackages[1].totalHandovers).toBe(0);
  });

  it('bỏ gói Săn đã hết hạn khỏi danh sách ACTIVE', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        huntPackages: [huntRow({ expiresAt: past(1) })],
      }),
    );

    const result = await service.getOverview('company-1');
    expect(result.activeHuntPackages).toHaveLength(0);
  });

  it('gói UNUSED (chờ kích hoạt) vào pendingPackages, không vào ACTIVE', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        jobPackages: [
          jobRow({ id: 'j1', status: 'UNUSED', expiresAt: null, activatedAt: null }),
        ],
        huntPackages: [
          huntRow({
            id: 'h1',
            status: 'UNUSED',
            expiresAt: null,
            activatedAt: null,
            campaign: null,
          }),
        ],
      }),
    );

    const result = await service.getOverview('company-1');

    expect(result.activeJobPackages).toHaveLength(0);
    expect(result.activeHuntPackages).toHaveLength(0);
    expect(result.pendingPackages).toHaveLength(2);
    expect(result.pendingPackages.map((p) => p.kind).sort()).toEqual(['hunt', 'job']);
  });

  it('bỏ gói UNUSED quá hạn kích hoạt khỏi pendingPackages', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        huntPackages: [
          huntRow({
            status: 'UNUSED',
            expiresAt: null,
            activatedAt: null,
            campaign: null,
            activationDeadlineAt: past(1),
          }),
        ],
      }),
    );

    const result = await service.getOverview('company-1');
    expect(result.pendingPackages).toHaveLength(0);
  });

  it('đọc số dư Credit trực tiếp từ billing_credit_account', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        account: { balance: 164, lifetimeGranted: 302, lifetimeConsumed: 138 },
      }),
    );

    const result = await service.getOverview('company-1');

    expect(result.creditBalance).toBe(164);
    expect(result.lifetimeGranted).toBe(302);
    expect(result.lifetimeConsumed).toBe(138);
  });

  it('KHÔNG hiển thị hạn khi không có lô plan_grant sắp hết hạn', async () => {
    const service = new BillingOverviewService(
      makePrisma({ account: { balance: 164, lifetimeGranted: 302, lifetimeConsumed: 138 } }),
    );

    const result = await service.getOverview('company-1');
    expect(result.expiringLot).toBeNull();
  });

  it('hiển thị lô plan_grant sắp hết hạn nếu có', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        account: { balance: 164, lifetimeGranted: 302, lifetimeConsumed: 138 },
        lots: [
          {
            granted: 50,
            consumed: 20,
            expiresAt: future(10),
            sourceType: 'plan',
          },
        ],
      }),
    );

    const result = await service.getOverview('company-1');
    expect(result.expiringLot).not.toBeNull();
    expect(result.expiringLot?.available).toBe(30);
  });

  it('bỏ qua lô đã tiêu hết khả dụng', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        account: { balance: 164, lifetimeGranted: 302, lifetimeConsumed: 138 },
        lots: [{ granted: 50, consumed: 50, expiresAt: future(10), sourceType: 'plan' }],
      }),
    );

    const result = await service.getOverview('company-1');
    expect(result.expiringLot).toBeNull();
  });

  it('tính 1 vị trí cho mỗi gói Săn ACTIVE đã gắn chiến dịch', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        huntPackages: [
          huntRow({ id: 'h1', code: 'TS-1', campaign: { id: 'c1', title: 'A' } }),
          huntRow({ id: 'h2', code: 'TS-2', campaign: null }),
        ],
      }),
    );

    const result = await service.getOverview('company-1');
    expect(result.activeHuntPackages[0].positionsUsed).toBe(1);
    expect(result.activeHuntPackages[0].positionsTotal).toBe(1);
    expect(result.activeHuntPackages[1].positionsUsed).toBe(0);
  });

  it('trả về danh sách rỗng khi công ty chưa có gói nào', async () => {
    const service = new BillingOverviewService(
      makePrisma({
        jobPackages: [],
        huntPackages: [],
        account: { balance: 0, lifetimeGranted: 0, lifetimeConsumed: 0 },
      }),
    );

    const result = await service.getOverview('company-1');

    expect(result.activeJobPackages).toEqual([]);
    expect(result.activeHuntPackages).toEqual([]);
    expect(result.pendingPackages).toEqual([]);
    expect(result.creditBalance).toBe(0);
  });
});
