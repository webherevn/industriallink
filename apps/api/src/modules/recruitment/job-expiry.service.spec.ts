import { JobStatus } from '@industriallink/contracts';
import { JobExpiryService } from './job-expiry.service';

describe('JobExpiryService', () => {
  const events = { publish: jest.fn() };
  const indexing = { notifyJob: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    events.publish.mockClear();
    indexing.notifyJob.mockClear();
  });

  it('đóng tin có deadline < ngày hôm nay theo giờ Việt Nam ngay từ 00:00:00 giờ VN (17:00 UTC hôm trước)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'job-1',
        tenantId: 'default',
        code: 'JOB-2026-000001',
        title: 'Kỹ sư PLC',
        slug: 'ky-su-plc',
        industry: 'Tự động hóa & Điều khiển',
      },
    ]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { job: { findMany, updateMany } };
    const service = new JobExpiryService(prisma as never, events as never, indexing as never);

    // 2026-08-31T17:00:05.000Z = 00:00:05 ngày 2026-09-01 giờ Việt Nam
    const closedCount = await service.closeExpiredJobs(new Date('2026-08-31T17:00:05.000Z'));

    expect(closedCount).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          status: JobStatus.Published,
          deadline: { lt: new Date('2026-09-01T00:00:00.000Z') },
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1'] }, status: JobStatus.Published },
      data: { status: JobStatus.Closed },
    });
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(indexing.notifyJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      'URL_DELETED',
    );
  });
});
