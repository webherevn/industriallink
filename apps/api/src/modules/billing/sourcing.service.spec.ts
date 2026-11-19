/**
 * SourcingService — các ràng buộc nghiệp vụ cốt lõi của luồng "Săn nhân sự".
 *
 * - B1: vòng đời gói Săn KHÔNG bị chi phối bởi `assignment.endsAt`.
 * - B2: `positionsRemaining` = số gói Săn CHỜ kích hoạt (UNUSED), không theo hạn chu kỳ.
 * - B3: phạm vi dịch vụ lấy theo GÓI của chiến dịch, không theo gói Săn đầu tiên.
 * - B5: mở hồ sơ ứng viên tiềm năng luôn trừ Credit ví dùng chung (không có nhánh miễn phí
 *      theo assignment/gói) — chỉ cô lập "đã mở" theo CHIẾN DỊCH.
 * - B6: gói Săn chờ kích hoạt có hạn chót riêng; gói quá hạn → EXPIRED.
 */
import { SourcingService } from './sourcing.service';

type PrismaMock = Record<string, any>;

function makePrisma(overrides: PrismaMock = {}): PrismaMock {
  return {
    billingCompanySourcingPlan: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    billingHuntPackage: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    huntCampaign: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    huntCampaignActivity: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    job: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    ...overrides,
  };
}

function makeService(prisma: PrismaMock) {
  const huntPackages = {
    listForCompany: jest.fn().mockResolvedValue([]),
    findUnused: jest.fn(),
    activateWithCampaign: jest.fn(),
  };
  const service = new SourcingService(prisma as never, huntPackages as never);
  return { service, huntPackages };
}

describe('SourcingService', () => {
  describe('coverIncludedOpen (B5)', () => {
    it('luôn trả "skip" (trừ Credit ví dùng chung) khi không có campaignId', async () => {
      const prisma = makePrisma({
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'as-1',
            isActive: true,
            startsAt: new Date('2026-01-01'),
            endsAt: new Date('2026-12-01'),
            plan: { code: 'SAN_TIEU_CHUAN', serviceScope: '[]', positionQuota: 1 },
          }),
          update: jest.fn(),
        },
      });
      const { service } = makeService(prisma);

      const res = await service.coverIncludedOpen({
        companyId: 'co-1',
        candidateId: 'can-1',
        campaignId: null,
      });

      expect(res).toBe('skip');
      expect(prisma.huntCampaignActivity.findMany).not.toHaveBeenCalled();
    });

    it('chỉ coi là "repeat" khi ứng viên đã mở trong CHÍNH chiến dịch đó', async () => {
      const findMany = jest.fn().mockResolvedValue([{ id: 'act-1', note: 'open:can-1' }]);
      const prisma = makePrisma({
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'as-1',
            isActive: true,
            startsAt: new Date('2026-01-01'),
            endsAt: new Date('2026-12-01'),
            plan: { code: 'SAN_TIEU_CHUAN', serviceScope: '[]', positionQuota: 1 },
          }),
          update: jest.fn(),
        },
        huntCampaignActivity: { findMany, count: jest.fn().mockResolvedValue(0) },
      });
      const { service } = makeService(prisma);

      const res = await service.coverIncludedOpen({
        companyId: 'co-1',
        candidateId: 'can-1',
        campaignId: 'camp-1',
      });

      expect(res).toBe('repeat');
      // Mốc "đã mở" phải CÔ LẬP theo chiến dịch.
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ campaignId: 'camp-1' }),
        }),
      );
    });

    it('trả "skip" khi công ty chưa có gói Săn', async () => {
      const prisma = makePrisma();
      const { service } = makeService(prisma);

      const res = await service.coverIncludedOpen({
        companyId: 'co-1',
        candidateId: 'can-1',
        campaignId: 'camp-1',
      });

      expect(res).toBe('skip');
    });
  });

  describe('getEntitlements (B2)', () => {
    it('positionsRemaining = số gói Săn UNUSED, không phụ thuộc hạn chu kỳ assignment', async () => {
      const prisma = makePrisma({
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'as-1',
            companyId: 'co-1',
            isActive: true,
            startsAt: new Date('2026-01-01'),
            endsAt: new Date('2026-12-01'),
            activatedAt: new Date('2026-01-01'),
            positionsUsed: 0,
            searchRoundsUsed: 0,
            shortlistsUsed: 0,
            revisionsUsed: 0,
            extraPositionQuota: 0,
            extraSearchRoundQuota: 0,
            extraShortlistQuota: 0,
            extraRevisionQuota: 0,
            extraCreditQuota: 0,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
            plan: {
              code: 'SAN_TIEU_CHUAN',
              name: 'Gói Săn Tiêu Chuẩn',
              feeVnd: 7_990_000n,
              serviceScope: '["ai_match"]',
              positionQuota: 1,
              searchRoundQuota: 4,
              shortlistQuota: 4,
              revisionQuota: 4,
              creditQuota: 30,
              durationDays: 30,
            },
          }),
          update: jest.fn().mockResolvedValue(null),
        },
        billingHuntPackage: { count: jest.fn().mockResolvedValue(3), updateMany: jest.fn() },
      });
      const { service } = makeService(prisma);

      const e = await service.getEntitlements('co-1');

      expect(e.positionsRemaining).toBe(3);
      expect(prisma.billingHuntPackage.count).toHaveBeenCalledWith({
        where: { companyId: 'co-1', status: 'UNUSED' },
      });
    });
  });

  describe('getWorkspace (B6)', () => {
    it('vẫn trả gói Săn chờ kích hoạt khi chưa có assignment', async () => {
      const prisma = makePrisma({
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      });
      const { service, huntPackages } = makeService(prisma);
      huntPackages.listForCompany.mockResolvedValue([
        { id: 'pkg-1', code: 'TS-000101', status: 'UNUSED' },
      ]);

      const ws = await service.getWorkspace('co-1');

      expect(ws.packages).toHaveLength(1);
      expect(ws.campaigns).toHaveLength(0);
    });
  });

  describe('settleExpiredPlan (B1)', () => {
    it('KHÔNG tắt assignment khi còn gói Săn ACTIVE hoặc chiến dịch còn hiệu lực', async () => {
      const update = jest.fn();
      const assignmentRow = {
        id: 'as-1',
        companyId: 'co-1',
        isActive: true,
        activatedAt: new Date('2026-01-01'),
        startsAt: new Date('2026-01-01'),
        // Đã hết hạn chu kỳ cấp gói
        endsAt: new Date('2026-02-01'),
        positionsUsed: 0,
        searchRoundsUsed: 0,
        shortlistsUsed: 0,
        revisionsUsed: 0,
        extraPositionQuota: 0,
        extraSearchRoundQuota: 0,
        extraShortlistQuota: 0,
        extraRevisionQuota: 0,
        extraCreditQuota: 0,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        plan: {
          code: 'SAN_TIEU_CHUAN',
          name: 'Gói Săn Tiêu Chuẩn',
          feeVnd: 7_990_000n,
          serviceScope: '["ai_match"]',
          positionQuota: 1,
          searchRoundQuota: 4,
          shortlistQuota: 4,
          revisionQuota: 4,
          creditQuota: 30,
          durationDays: 30,
        },
      };
      const prisma = makePrisma({
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue(assignmentRow),
          update,
        },
        billingHuntPackage: {
          count: jest.fn().mockResolvedValue(1),
          updateMany: jest.fn(),
        },
        huntCampaign: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
      });
      const { service } = makeService(prisma);

      await service.getEntitlements('co-1');

      // Không được tắt assignment (isActive = false).
      const offCalls = update.mock.calls.filter(
        (c) => c[0]?.data?.isActive === false,
      );
      expect(offCalls).toHaveLength(0);
    });
  });

  describe('assertScope / assertCampaignScope (B3)', () => {
    it('gate phạm vi dùng GÓI CỦA CHIẾN DỊCH, không dùng gói Săn đầu tiên', () => {
      const prisma = makePrisma();
      const { service } = makeService(prisma);

      const assertCampaignScope = (service as unknown as {
        assertCampaignScope: (p: unknown, k: string) => void;
      }).assertCampaignScope.bind(service);

      // Gói Cơ bản / Tiêu chuẩn đều có 'shortlist' → cho phép shortlist.
      const basic = {
        packageType: 'BASIC',
        packageName: 'Gói Săn Cơ Bản',
        code: 'TS-000101',
      } as never;
      const standard = {
        packageType: 'STANDARD',
        packageName: 'Gói Săn Tiêu Chuẩn',
        code: 'TS-000102',
      } as never;

      expect(() => assertCampaignScope(basic, 'shortlist')).not.toThrow();
      expect(() => assertCampaignScope(standard, 'shortlist')).not.toThrow();
      // Mọi gói đều có 'ai_match' + 'filter_rank'.
      expect(() => assertCampaignScope(basic, 'search_round')).not.toThrow();
      expect(() => assertCampaignScope(basic, 'position')).not.toThrow();
    });

    it('gói không xác định không chặn (scope rỗng → bỏ qua gate)', () => {
      const prisma = makePrisma();
      const { service } = makeService(prisma);
      const pkg = {
        packageType: 'UNKNOWN',
        packageName: 'Gói lạ',
        code: 'TS-000999',
      } as never;

      const assertCampaignScope = (service as unknown as {
        assertCampaignScope: (p: unknown, k: string) => void;
      }).assertCampaignScope.bind(service);

      expect(() => assertCampaignScope(pkg, 'shortlist')).not.toThrow();
    });
  });
});
