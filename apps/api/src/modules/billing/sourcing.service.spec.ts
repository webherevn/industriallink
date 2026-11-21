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
import { BadRequestException } from '@nestjs/common';
import { SourcingService } from './sourcing.service';

/** Mock Prisma cho test — cấu trúc tuỳ ý, không kiểm tra type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      expect(prisma.billingHuntPackage.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'co-1', status: 'UNUSED' }),
        }),
      );
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

  // ==============================================================
  // (A) KHÓA CHIỀU 2 — Gói Tin săn × Gói Tin đăng (loại trừ lẫn nhau)
  // ==============================================================
  describe('consume — khóa chiều 2 (A)', () => {
    const JOB_UUID = '11111111-1111-4111-8111-111111111111';

    const ACTIVE_ASSIGNMENT = {
      id: 'as-1',
      companyId: 'co-1',
      isActive: true,
      activatedAt: new Date('2026-01-01'),
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-01'),
      reserveEndsAt: null,
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

    const UNUSED_HUNT_PACKAGE = {
      id: 'hunt-pkg-1',
      code: 'TS-000101',
      companyId: 'co-1',
      status: 'UNUSED',
      packageType: 'STANDARD',
      packageName: 'Gói Săn Tiêu Chuẩn',
      durationDays: 30,
      totalCriteriaEdits: 4,
      usedCriteriaEdits: 0,
      totalReports: 4,
      usedReports: 0,
      expiresAt: null,
      purchasedAt: new Date('2026-01-01'),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function makeConsumePrisma(overrides: Record<string, any> = {}) {
      const jobUpdate = jest.fn().mockResolvedValue({});
      const jobCreate = jest.fn().mockResolvedValue({ id: 'job-new', code: 'JOB-2026-000099' });
      const tx = {
        billingCompanySourcingPlan: {
          findUnique: jest.fn().mockResolvedValue(ACTIVE_ASSIGNMENT),
          update: jest.fn().mockResolvedValue(ACTIVE_ASSIGNMENT),
        },
        huntCampaign: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
        },
        huntCampaignActivity: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        job: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          create: jobCreate,
          update: jobUpdate,
          updateMany: jest.fn(),
        },
        company: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
        billingHuntPackage: { update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
        sequence: {
          upsert: jest.fn().mockResolvedValue({ value: 99n }),
        },
        ...overrides,
      };
      const prisma = {
        ...tx,
        $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
      };
      return { prisma, tx, jobUpdate, jobCreate };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function makeConsumeService(prisma: any, jobRow: any) {
      const huntPackages = {
        listForCompany: jest.fn().mockResolvedValue([]),
        findUnused: jest.fn().mockResolvedValue(UNUSED_HUNT_PACKAGE),
        activateWithCampaign: jest
          .fn()
          .mockResolvedValue({ campaignId: 'camp-1', campaignCode: 'CS-001' }),
        getCampaignResource: jest.fn().mockResolvedValue(null),
        lockPackage: jest.fn(),
      };
      prisma.huntCampaign.findFirst.mockResolvedValue(null);
      prisma.job.findFirst.mockResolvedValue(jobRow);
      const service = new SourcingService(prisma as never, huntPackages as never);
      return { service, huntPackages };
    }

    const paidStandardJob = {
      id: JOB_UUID,
      code: 'JOB-2026-000055',
      title: 'Kỹ sư PLC',
      description: 'Mô tả',
      requirements: null,
      benefits: null,
      industry: null,
      subIndustry: null,
      department: null,
      jobLevel: null,
      employmentType: null,
      location: null,
      headcount: 1,
      deadline: new Date('2026-12-01T00:00:00.000Z'),
      experienceBand: null,
      salaryMin: null,
      salaryMax: null,
      jobTrack: null,
      salesCriteria: null,
      technicalCriteria: null,
      status: 'published',
      publishedAt: new Date('2026-11-18T00:00:00.000Z'),
      tenantId: 'default',
      jobPackageId: 'pkg-paid',
      jobPackage: { packageType: 'ENTERPRISE' },
      skills: [],
    };

    it('CHẶN (400) khi gắn gói Tin săn vào tin PUBLISHED đang chạy gói Tin đăng TRẢ PHÍ', async () => {
      const { prisma, tx, jobUpdate } = makeConsumePrisma();
      const { service } = makeConsumeService(prisma, paidStandardJob);

      await expect(
        service.consume(
          { id: 'user-1', email: 'r@abc.com', role: 'recruiter' } as never,
          'co-1',
          { kind: 'position', jobId: JOB_UUID },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // KHÔNG được tạo tin mới, KHÔNG được đụng tin cũ.
      expect(tx.job.create).not.toHaveBeenCalled();
      expect(jobUpdate).not.toHaveBeenCalled();
    });

    it('CHO PHÉP gắn gói Tin săn vào tin DRAFT / FREE / CLOSED', async () => {
      for (const jobRow of [
        { ...paidStandardJob, status: 'draft', jobPackage: null, jobPackageId: null },
        { ...paidStandardJob, jobPackage: { packageType: 'FREE' } },
        { ...paidStandardJob, status: 'closed', jobPackage: null, jobPackageId: null },
      ]) {
        const { prisma, tx } = makeConsumePrisma();
        const { service } = makeConsumeService(prisma, jobRow);

        await service.consume(
          { id: 'user-1', email: 'r@abc.com', role: 'recruiter' } as never,
          'co-1',
          { kind: 'position', jobId: JOB_UUID },
        );

        // Tin được đồng bộ sang nguồn gói Săn: gỡ jobPackageId + đặt hạn 30 ngày.
        const updateCall = tx.job.update.mock.calls[0][0];
        expect(updateCall.data.jobPackageId).toBeNull();
        expect(updateCall.data.status).toBe('published');
        const deadline = updateCall.data.deadline as Date;
        const days = Math.round(
          (deadline.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
        );
        // Hạn = now + 30 ngày (KHÔNG cộng dồn thành 60).
        expect(days).toBeGreaterThan(28);
        expect(days).toBeLessThanOrEqual(30);
      }
    });

    it('CHẶN (400) khi tin đã thuộc 1 chiến dịch Săn khác (trùng JD)', async () => {
      const { prisma, tx } = makeConsumePrisma();
      const { service } = makeConsumeService(prisma, {
        ...paidStandardJob,
        status: 'draft',
        jobPackage: null,
        jobPackageId: null,
      });
      tx.huntCampaign.findFirst.mockResolvedValue({ id: 'camp-old' });

      await expect(
        service.consume(
          { id: 'user-1', email: 'r@abc.com', role: 'recruiter' } as never,
          'co-1',
          { kind: 'position', jobId: JOB_UUID },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('"Copy nội dung JD sang Tin săn mới" tạo Job MỚI, không đụng tin cũ, hạn đúng 30 ngày', async () => {
      const { prisma, tx, jobUpdate } = makeConsumePrisma();
      const { service, huntPackages } = makeConsumeService(prisma, paidStandardJob);

      await service.consume(
        { id: 'user-1', email: 'r@abc.com', role: 'recruiter' } as never,
        'co-1',
        {
          kind: 'position',
          jobId: JOB_UUID,
          copyJdToNewJob: true,
          closeSourceJob: true,
        },
      );

      // 1) Tạo 1 bản ghi Job MỚI với mã/slug riêng, KHÔNG gắn gói tin đăng.
      expect(tx.job.create).toHaveBeenCalledTimes(1);
      const created = tx.job.create.mock.calls[0][0].data;
      expect(created.title).toBe('Kỹ sư PLC');
      expect(created.description).toBe('Mô tả');
      expect(created.jobPackageId).toBeNull();
      expect(created.code).toBe('JOB-2026-000099');
      expect(created.slug).toBeTruthy();

      // 2) Chiến dịch gắn vào TIN MỚI (không phải tin cũ).
      expect(huntPackages.activateWithCampaign).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ jobId: 'job-new' }),
      );

      // 3) Tin cũ KHÔNG bị ghi đè nguồn gói / hạn — chỉ được đóng (tuỳ chọn).
      const oldJobUpdates = jobUpdate.mock.calls.filter((c) => c[0].where.id === JOB_UUID);
      expect(oldJobUpdates).toHaveLength(1);
      expect(oldJobUpdates[0][0].data).toEqual({ status: 'closed', pausedAt: null });

      // 4) Tin mới: hạn đúng 30 ngày, gỡ gói tin đăng.
      const newJobUpdate = jobUpdate.mock.calls.find((c) => c[0].where.id === 'job-new');
      expect(newJobUpdate).toBeDefined();
      expect(newJobUpdate[0].data.jobPackageId).toBeNull();
      const deadline = newJobUpdate[0].data.deadline as Date;
      const days = Math.round(
        (deadline.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(days).toBeGreaterThan(28);
      expect(days).toBeLessThanOrEqual(30);
    });
  });
});
