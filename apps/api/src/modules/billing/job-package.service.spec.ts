/**
 * JobPackageService — khóa loại trừ CHIỀU 1 giữa Gói Tin đăng và Gói Tin săn.
 *
 * BẤT BIẾN: Một tin `PUBLISHED` chỉ được nuôi bởi DUY NHẤT 1 nguồn gói trả phí.
 * Nếu tin đang chạy bằng gói Săn nhân sự (chiến dịch `ACTIVE`) thì KHÔNG được
 * gắn thêm gói Tin đăng → phải chặn cứng (HTTP 400).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobPackageService } from './job-package.service';
import { HUNT_OWNED_JOB_REASON } from './job-package-source.util';
import type { AuthenticatedUser } from '../../shared/security/security.types';

/** Mock Prisma cho test — cấu trúc tuỳ ý, không kiểm tra type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaMock = Record<string, any>;

const recruiter: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@abc.com',
  role: 'recruiter' as never,
  tenantId: 'default',
  displayName: 'NTD A',
  status: 'active',
};

const PACKAGE_ROW = {
  id: 'pkg-1',
  code: 'JD-ST-000001',
  status: 'ACTIVE',
  company_id: 'co-1',
  package_name: 'Gói Tin đăng tiêu chuẩn',
  total_jobs: 3,
  used_jobs: 0,
  credits_granted: true,
  credits_included: 0,
  duration_days: 30,
  expires_at: new Date('2026-12-31T00:00:00.000Z'),
  activation_deadline_at: null,
};

function makeService(overrides: PrismaMock = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([PACKAGE_ROW]),
    job: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'job-1',
        code: 'JOB-2026-000001',
        title: 'Kỹ sư PLC',
        status: 'published',
        jobPackageId: null,
      }),
      update: jest.fn(),
    },
    huntCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
    billingJobPackage: { update: jest.fn() },
    billingAuditLog: { create: jest.fn() },
    company: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'default' }) },
    billingCreditAccount: { upsert: jest.fn(), update: jest.fn() },
    billingCreditLot: { create: jest.fn() },
    billingCreditTransaction: { create: jest.fn() },
    ...overrides,
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const service = new JobPackageService(prisma as never);
  return { service, tx };
}

describe('JobPackageService — khóa chiều 1 (Gói Tin đăng × Gói Tin săn)', () => {
  it('CHẶN (400) khi gắn gói Tin đăng vào tin đang chạy Tin săn ACTIVE', async () => {
    const { service, tx } = makeService();
    // Tin đang thuộc 1 chiến dịch Săn ACTIVE.
    tx.huntCampaign.findFirst.mockResolvedValue({ id: 'camp-1' });

    await expect(
      service.activateAndApply(recruiter, 'co-1', 'pkg-1', 'job-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.activateAndApply(recruiter, 'co-1', 'pkg-1', 'job-1'),
    ).rejects.toThrow(HUNT_OWNED_JOB_REASON);

    // KHÔNG được đụng vào tin / gói / credit.
    expect(tx.job.update).not.toHaveBeenCalled();
    expect(tx.billingJobPackage.update).not.toHaveBeenCalled();
    expect(tx.billingCreditTransaction.create).not.toHaveBeenCalled();
  });

  it('CHO PHÉP gắn gói Tin đăng khi tin KHÔNG thuộc chiến dịch Săn nào', async () => {
    const { service, tx } = makeService();
    tx.huntCampaign.findFirst.mockResolvedValue(null);
    tx.billingJobPackage.update.mockImplementation(async () => ({
      totalJobs: 3,
      usedJobs: 1,
    }));

    const res = await service.activateAndApply(recruiter, 'co-1', 'pkg-1', 'job-1');

    expect(res.jobId).toBe('job-1');
    expect(res.packageCode).toBe('JD-ST-000001');
    // Tin được gắn gói + đưa về hàng đợi kiểm duyệt (KHÔNG publish thẳng).
    expect(tx.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          jobPackageId: 'pkg-1',
          status: 'draft',
          moderationStatus: 'pending',
        }),
      }),
    );
  });

  it('ném NotFoundException khi tin không tồn tại / không thuộc công ty', async () => {
    const { service, tx } = makeService();
    tx.job.findFirst.mockResolvedValue(null);

    await expect(
      service.activateAndApply(recruiter, 'co-1', 'pkg-1', 'job-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
