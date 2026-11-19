/**
 * Mô hình 1-1: Gói Săn (BillingHuntPackage) ↔ Chiến dịch (HuntCampaign).
 *
 * - 1 gói chỉ gắn tối đa 1 chiến dịch (UNIQUE hunt_campaign.hunt_package_id).
 * - Kích hoạt gói + tạo chiến dịch là 1 transaction: gói UNUSED → ACTIVE,
 *   set activatedAt / expiresAt, cộng creditsIncluded vào Ví Credit dùng chung
 *   (chỉ 1 lần qua cờ credits_granted).
 * - Hạn mức (điều chỉnh / báo cáo / bàn giao) trừ theo GÓI của chiến dịch đó.
 */
import { HuntPackageService } from './hunt-package.service';

/** Prisma mock tối thiểu cho HuntPackageService (chỉ dùng transaction client). */
function makeTx(overrides: Record<string, unknown> = {}) {
  const state = {
    huntCampaign: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    billingCreditAccount: { upsert: jest.fn(), update: jest.fn() },
    billingCreditLot: { create: jest.fn() },
    billingCreditTransaction: { create: jest.fn() },
    billingHuntPackage: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
    billingAuditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
    ...overrides,
  };
  return state;
}

describe('HuntPackageService', () => {
  let service: HuntPackageService;

  beforeEach(() => {
    service = new HuntPackageService({} as never);
  });

  describe('quotaFor / packageTypeForPlan', () => {
    it('ánh xạ mã gói nền tảng sang loại gói Săn', () => {
      expect(service.packageTypeForPlan('SAN_CO_BAN')).toBe('BASIC');
      expect(service.packageTypeForPlan('SAN_TIEU_CHUAN')).toBe('STANDARD');
      expect(service.packageTypeForPlan('SAN_CHUYEN_SAU')).toBe('DEEP');
      expect(service.packageTypeForPlan(null)).toBe('BASIC');
    });

    it('chỉ gói Chuyên sâu mới có lượt bàn giao Inlink', () => {
      expect(service.quotaFor('BASIC').totalHandovers).toBe(0);
      expect(service.quotaFor('STANDARD').totalHandovers).toBe(0);
      expect(service.quotaFor('DEEP').totalHandovers).toBe(15);
    });

    it('hạn mức mặc định theo loại gói', () => {
      expect(service.quotaFor('BASIC')).toEqual({
        creditsIncluded: 30,
        totalCriteriaEdits: 4,
        totalReports: 1,
        totalHandovers: 0,
      });
      expect(service.quotaFor('STANDARD')).toEqual({
        creditsIncluded: 30,
        totalCriteriaEdits: 4,
        totalReports: 4,
        totalHandovers: 0,
      });
      expect(service.quotaFor('DEEP')).toEqual({
        creditsIncluded: 50,
        totalCriteriaEdits: 30,
        totalReports: 4,
        totalHandovers: 15,
      });
    });
  });

  describe('activateWithCampaign', () => {
    it('tạo chiến dịch + chuyển gói sang ACTIVE + cấp Credit vào ví dùng chung', async () => {
      const now = Date.now();
      const tx = makeTx();
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pkg-1',
          status: 'UNUSED',
          credits_granted: false,
          credits_included: 30,
          duration_days: 30,
          package_name: 'Gói Săn Tiêu Chuẩn',
          code: 'TS-000101',
        },
      ]);
      // Mã chiến dịch
      tx.billingCreditAccount.upsert.mockResolvedValue({ id: 'acc-1' });
      tx.billingCreditAccount.update.mockResolvedValue({ balance: 30 });
      tx.huntCampaign.create.mockResolvedValue({ id: 'camp-1', code: 'HD-000001' });
      tx.billingHuntPackage.update.mockResolvedValue({});
      tx.billingHuntPackage.findUniqueOrThrow.mockResolvedValue({ id: 'pkg-1' });

      const res = await service.activateWithCampaign(tx as never, {
        companyId: 'co-1',
        tenantId: 'default',
        packageId: 'pkg-1',
        assignmentId: 'as-1',
        jobId: 'job-1',
        title: 'Kỹ sư PLC',
        actorUserId: null,
        actorEmail: null,
      });

      // 1) Chiến dịch gắn đúng gói
      expect(tx.huntCampaign.create).toHaveBeenCalledTimes(1);
      const campaignArg = tx.huntCampaign.create.mock.calls[0][0].data;
      expect(campaignArg.huntPackageId).toBe('pkg-1');
      expect(campaignArg.jobId).toBe('job-1');
      expect(campaignArg.status).toBe('open');
      expect(campaignArg.code).toMatch(/^HD-\d{6}$/);

      // 2) Gói chuyển ACTIVE, có activatedAt/expiresAt, creditsGranted = true
      const pkgUpdate = tx.billingHuntPackage.update.mock.calls[0][0].data;
      expect(pkgUpdate.status).toBe('ACTIVE');
      expect(pkgUpdate.activatedAt).toBeInstanceOf(Date);
      expect(pkgUpdate.expiresAt).toBeInstanceOf(Date);
      expect(pkgUpdate.creditsGranted).toBe(true);

      // 3) Credit cộng vào ví dùng chung, lô VÔ THỜI HẠN (giữ lại khi gói hết hạn)
      expect(tx.billingCreditAccount.update).toHaveBeenCalledTimes(1);
      const acctUpdate = tx.billingCreditAccount.update.mock.calls[0][0].data;
      expect(acctUpdate.balance).toEqual({ increment: 30 });
      expect(acctUpdate.lifetimeGranted).toEqual({ increment: 30 });

      const lotArg = tx.billingCreditLot.create.mock.calls[0][0].data;
      expect(lotArg.granted).toBe(30);
      expect(lotArg.sourceType).toBe('package');
      expect(lotArg.sourceKey).toBe('TS-000101');
      // Credit của gói mua → GIỮ LẠI vô thời hạn trong ví dùng chung.
      expect(lotArg.expiresAt).toBeNull();

      // 4) Ledger ghi nhận cấp Credit có campaignId
      const grantTx = tx.billingCreditTransaction.create.mock.calls[0][0].data;
      expect(grantTx.type).toBe('grant');
      expect(grantTx.creditDelta).toBe(30);
      expect(grantTx.campaignId).toBe(res.campaignId);

      expect(res.campaignId).toBe(campaignArg.id ?? res.campaignId);
      expect(now).toBeLessThan(Date.now() + 1);
    });

    it('KHÔNG cấp Credit lần 2 khi credits_granted đã true', async () => {
      const tx = makeTx();
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pkg-1',
          status: 'UNUSED',
          credits_granted: true,
          credits_included: 30,
          duration_days: 30,
          package_name: 'Gói Săn Tiêu Chuẩn',
          code: 'TS-000101',
        },
      ]);
      tx.billingHuntPackage.update.mockResolvedValue({});
      tx.billingHuntPackage.findUniqueOrThrow.mockResolvedValue({ id: 'pkg-1' });
      tx.huntCampaign.create.mockResolvedValue({ id: 'camp-1', code: 'HD-000001' });

      await service.activateWithCampaign(tx as never, {
        companyId: 'co-1',
        tenantId: 'default',
        packageId: 'pkg-1',
        assignmentId: 'as-1',
        jobId: 'job-1',
        title: 'Kỹ sư PLC',
        actorUserId: null,
        actorEmail: null,
      });

      expect(tx.billingCreditAccount.update).not.toHaveBeenCalled();
      expect(tx.billingCreditLot.create).not.toHaveBeenCalled();
      expect(tx.billingCreditTransaction.create).not.toHaveBeenCalled();
      // Gói vẫn ACTIVE, nhưng creditsGranted giữ nguyên true
      const pkgUpdate = tx.billingHuntPackage.update.mock.calls[0][0].data;
      expect(pkgUpdate.status).toBe('ACTIVE');
      expect(pkgUpdate.creditsGranted).toBe(true);
    });

    it('ném lỗi khi gói không còn ở trạng thái UNUSED', async () => {
      const tx = makeTx();
      tx.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pkg-1',
          status: 'ACTIVE',
          credits_granted: true,
          credits_included: 30,
          duration_days: 30,
          package_name: 'Gói Săn Tiêu Chuẩn',
          code: 'TS-000101',
        },
      ]);

      await expect(
        service.activateWithCampaign(tx as never, {
          companyId: 'co-1',
          tenantId: 'default',
          packageId: 'pkg-1',
          assignmentId: 'as-1',
          jobId: 'job-1',
          title: 'Kỹ sư PLC',
          actorUserId: null,
          actorEmail: null,
        }),
      ).rejects.toThrow(/chờ kích hoạt/i);
      expect(tx.huntCampaign.create).not.toHaveBeenCalled();
    });
  });
});
