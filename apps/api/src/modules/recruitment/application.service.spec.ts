import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, JobStatus } from '@industriallink/contracts';
import { ApplicationService } from './application.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('ApplicationService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('APP-2026-000001') };
  const jobs = { requireOwnedJob: jest.fn() };
  const matching = {
    computePairMatch: jest.fn().mockResolvedValue({ score: 80, reason: 'Khớp kỹ năng', matchedSkills: [] }),
  };
  const companies = { requireUserCompany: jest.fn() };
  const email = {
    webOrigin: 'http://localhost:3000',
    sendSafe: jest.fn(),
    sendMany: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
  };
  const ai = { chat: jest.fn() };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    jobs.requireOwnedJob.mockClear();
    matching.computePairMatch.mockClear();
    companies.requireUserCompany.mockClear();
    // Mặc định: NTD thuộc côngty 'company-1' (dùng cho paywall liên hệ & nguồn hồ sơ).
    companies.requireUserCompany.mockResolvedValue({ companyId: 'company-1' });
    email.sendMany.mockClear();
    ai.chat.mockReset();
    return new ApplicationService(
      prisma as never,
      codeGen as never,
      events as never,
      audit as never,
      jobs as never,
      matching as never,
      companies as never,
      email as never,
      ai as never,
    );
  }

  const candidateUser: AuthenticatedUser = {
    id: 'user-can-1',
    email: 'can@abc.com',
    role: 'candidate' as never,
    tenantId: 'default',
    displayName: 'Ứng viên A',
    status: 'active',
  };
  const recruiterUser: AuthenticatedUser = {
    id: 'user-r-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  describe('apply', () => {
    const candidateWithSalesTrack = {
      id: 'can-1',
      tenantId: 'default',
      profile: { jobTrack: 'sales' },
    };
    const candidateWithTechnicalTrack = {
      id: 'can-1',
      tenantId: 'default',
      profile: { jobTrack: 'technical' },
    };
    const publishedSalesJob = {
      id: 'job-1',
      code: 'JOB-1',
      title: 'Sales Engineer',
      status: JobStatus.Published,
      isDeleted: false,
      jobTrack: 'sales',
      jobLevel: 'sales.staff',
      company: { name: 'Công ty ABC', status: 'active', isDeleted: false },
    };
    const publishedTechnicalJob = {
      id: 'job-1',
      code: 'JOB-1',
      title: 'Kỹ sư PLC',
      status: JobStatus.Published,
      isDeleted: false,
      jobTrack: 'technical',
      jobLevel: 'technical.staff',
      company: { name: 'Công ty ABC', status: 'active', isDeleted: false },
    };

    it('ứng tuyển thành công, tính match score và phát ApplicationSubmitted', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'app-1',
        code: 'APP-2026-000001',
        jobId: 'job-1',
        status: ApplicationStatus.Applied,
        matchScore: 80,
        coverLetter: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithTechnicalTrack) },
        job: {
          findUnique: jest.fn().mockResolvedValue(publishedTechnicalJob),
        },
        application: { findUnique: jest.fn().mockResolvedValue(null), create },
      };
      const service = buildService(prisma);

      const result = await service.apply(candidateUser, 'job-1', {}, 'corr-1');

      expect(result.matchScore).toBe(80);
      expect(events.publish).toHaveBeenCalledTimes(1);
      expect(events.publish.mock.calls[0][0].name).toBe('recruitment.ApplicationSubmitted.v1');
    });

    it('từ chối nếu không phải ứng viên', async () => {
      const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.apply(recruiterUser, 'job-1', {}, 'corr-2')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('từ chối nếu tin chưa được đăng công khai', async () => {
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithTechnicalTrack) },
        job: {
          findUnique: jest.fn().mockResolvedValue({
            ...publishedTechnicalJob,
            status: JobStatus.Draft,
          }),
        },
      };
      const service = buildService(prisma);

      await expect(service.apply(candidateUser, 'job-1', {}, 'corr-3')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('từ chối nếu đã ứng tuyển vị trí này rồi', async () => {
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithTechnicalTrack) },
        job: {
          findUnique: jest.fn().mockResolvedValue(publishedTechnicalJob),
        },
        application: { findUnique: jest.fn().mockResolvedValue({ id: 'app-existing' }) },
      };
      const service = buildService(prisma);

      await expect(service.apply(candidateUser, 'job-1', {}, 'corr-4')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('⭐ cho phép ứng tuyển CHÉO lĩnh vực — hồ sơ Kỹ thuật nộp tin Kinh doanh', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'app-cross-1',
        code: 'APP-2026-000001',
        jobId: 'job-1',
        status: ApplicationStatus.Applied,
        matchScore: 80,
        coverLetter: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithTechnicalTrack) },
        job: { findUnique: jest.fn().mockResolvedValue(publishedSalesJob) },
        application: { findUnique: jest.fn().mockResolvedValue(null), create },
      };
      const service = buildService(prisma);

      const result = await service.apply(candidateUser, 'job-1', {}, 'corr-track-cross-1');

      // Không bị chặn 400 — tạo hồ sơ thành công.
      expect(result.id).toBe('app-cross-1');
      expect(create).toHaveBeenCalledTimes(1);
      // Trả về gợi ý mềm cho Frontend hiển thị (KHÔNG khóa nút nộp).
      expect(result.crossTrack).toBe(true);
      expect(result.candidateTrack).toBe('technical');
      expect(result.jobTrack).toBe('sales');
      expect(result.trackNotice).toEqual(expect.stringContaining('Kỹ thuật'));
    });

    it('⭐ cho phép ứng tuyển CHÉO lĩnh vực — hồ sơ Kinh doanh nộp tin Kỹ thuật', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'app-cross-2',
        code: 'APP-2026-000001',
        jobId: 'job-1',
        status: ApplicationStatus.Applied,
        matchScore: 80,
        coverLetter: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithSalesTrack) },
        job: { findUnique: jest.fn().mockResolvedValue(publishedTechnicalJob) },
        application: { findUnique: jest.fn().mockResolvedValue(null), create },
      };
      const service = buildService(prisma);

      const result = await service.apply(candidateUser, 'job-1', {}, 'corr-track-cross-2');

      expect(result.id).toBe('app-cross-2');
      expect(result.crossTrack).toBe(true);
      expect(result.trackNotice).toEqual(expect.stringContaining('Kinh doanh'));
    });

    it('⭐ cho phép ứng tuyển khi hồ sơ chưa chọn lĩnh vực (không còn chặn)', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'app-no-track',
        code: 'APP-2026-000001',
        jobId: 'job-1',
        status: ApplicationStatus.Applied,
        matchScore: 80,
        coverLetter: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        candidate: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'can-1',
            tenantId: 'default',
            profile: { jobTrack: null },
          }),
        },
        job: { findUnique: jest.fn().mockResolvedValue(publishedTechnicalJob) },
        application: { findUnique: jest.fn().mockResolvedValue(null), create },
      };
      const service = buildService(prisma);

      const result = await service.apply(candidateUser, 'job-1', {}, 'corr-track-1');

      expect(result.id).toBe('app-no-track');
      // Không chéo lĩnh vực (không xác định được) → không có gợi ý.
      expect(result.crossTrack).toBe(false);
      expect(result.trackNotice).toBeNull();
    });

    it('cho phép nộp tin legacy không có track khi hồ sơ đã có lĩnh vực', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'app-legacy',
        code: 'APP-2026-000001',
        jobId: 'job-1',
        status: ApplicationStatus.Applied,
        matchScore: 80,
        coverLetter: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue(candidateWithSalesTrack) },
        job: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'job-1',
            code: 'JOB-1',
            title: 'Nhân viên',
            status: JobStatus.Published,
            isDeleted: false,
            jobTrack: null,
            jobLevel: null,
            salesCriteria: null,
            technicalCriteria: null,
            company: { name: 'Công ty ABC', status: 'active', isDeleted: false },
          }),
        },
        application: { findUnique: jest.fn().mockResolvedValue(null), create },
      };
      const service = buildService(prisma);

      const result = await service.apply(candidateUser, 'job-1', {}, 'corr-track-4');
      expect(result.id).toBe('app-legacy');
    });
  });

  describe('updateStatus', () => {
    it('cập nhật trạng thái và phát ApplicationStatusChanged với from/to đúng', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', companyId: 'co-1' });
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            jobId: 'job-1',
            tenantId: 'default',
            status: ApplicationStatus.Applied,
            isDeleted: false,
          }),
          update,
        },
      };
      const service = buildService(prisma);

      const result = await service.updateStatus(
        recruiterUser,
        'app-1',
        { status: ApplicationStatus.Screening },
        'corr-5',
      );

      expect(result.status).toBe(ApplicationStatus.Screening);
      expect(events.publish).toHaveBeenCalledTimes(1);
      const evt = events.publish.mock.calls[0][0];
      expect(evt.payload).toEqual({
        applicationId: 'app-1',
        from: ApplicationStatus.Applied,
        to: ApplicationStatus.Screening,
      });
    });

    it('ném NotFoundException nếu hồ sơ không tồn tại', async () => {
      const prisma = { application: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.updateStatus(recruiterUser, 'missing', { status: ApplicationStatus.Screening }, 'corr-6'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('broadcastEmail', () => {
    it('từ chối nếu không có ứng viên khớp bộ lọc', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', title: 'Kỹ sư PLC', company: { name: 'ABC' } });
      const prisma = { application: { findMany: jest.fn().mockResolvedValue([]) } };
      const service = buildService(prisma);

      await expect(
        service.broadcastEmail(recruiterUser, 'job-1', { subject: 'Hi', body: 'Nội dung' }, 'corr-7'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('gửi email hàng loạt thành công và ghi timeline', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', title: 'Kỹ sư PLC', company: { name: 'ABC' } });
      email.sendMany.mockResolvedValue({ sent: 2, failed: 0 });
      const createMany = jest.fn().mockResolvedValue({ count: 2 });
      const prisma = {
        application: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'app-1',
              tenantId: 'default',
              candidateId: 'cand-1',
              candidate: { displayName: 'A', user: { email: 'a@abc.com' } },
            },
            {
              id: 'app-2',
              tenantId: 'default',
              candidateId: 'cand-2',
              candidate: { displayName: 'B', user: { email: 'b@abc.com' } },
            },
          ]),
        },
        applicationTimeline: { createMany },
      };
      const service = buildService(prisma);

      const result = await service.broadcastEmail(
        recruiterUser,
        'job-1',
        { subject: 'Thông báo', body: 'Nội dung email' },
        'corr-8',
      );

      expect(result).toEqual({
        recipients: 2,
        sent: 2,
        failed: 0,
        skippedByPaywall: 0,
        skippedMissingEmail: 0,
      });
      expect(createMany).toHaveBeenCalledTimes(1);
    });

    it('chỉ gửi hồ sơ được tick và từ chối hồ sơ không thuộc tin', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', title: 'Kỹ sư PLC', company: { name: 'ABC' } });
      const findMany = jest.fn().mockResolvedValue([
        {
          id: 'app-1',
          tenantId: 'default',
          candidateId: 'cand-1',
          candidate: { displayName: 'A', user: { email: 'a@abc.com' } },
        },
      ]);
      const service = buildService({
        application: { findMany },
        applicationTimeline: { createMany: jest.fn() },
      });

      await expect(
        service.broadcastEmail(
          recruiterUser,
          'job-1',
          { subject: 'Thông báo', body: 'Nội dung email', applicationIds: ['app-1', 'app-khac'] },
          'corr-9',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(email.sendMany).not.toHaveBeenCalled();
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ jobId: 'job-1', id: { in: ['app-1', 'app-khac'] } }),
        }),
      );
    });

    it('chặn gửi email cho ứng viên Săn chưa mở khóa hồ sơ (paywall)', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', title: 'Kỹ sư PLC', company: { name: 'ABC' } });
      email.sendMany.mockResolvedValue({ sent: 0, failed: 0 });
      const prisma = {
        application: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'app-1',
              tenantId: 'default',
              candidateId: 'cand-locked',
              candidate: { displayName: 'A', user: { email: 'a@abc.com' } },
            },
          ]),
        },
        // Tin này gắn 1 chiến dịch Săn + ứng viên do Săn mang về (trong shortlist) → chưa mở khóa bằng Credit.
        huntCampaign: {
          findMany: jest.fn().mockResolvedValue([{ jobId: 'job-1' }]),
        },
        candidateShortlist: {
          findMany: jest.fn().mockResolvedValue([{ candidateId: 'cand-locked' }]),
        },
        // Chưa có giao dịch mở khóa profile cho ứng viên này.
        billingCreditTransaction: { findMany: jest.fn().mockResolvedValue([]) },
        candidateConnection: { findMany: jest.fn().mockResolvedValue([]) },
        applicationTimeline: { createMany: jest.fn() },
      };
      const service = buildService(prisma);

      await expect(
        service.broadcastEmail(
          recruiterUser,
          'job-1',
          { subject: 'Thông báo', body: 'Nội dung email' },
          'corr-paywall',
        ),
      ).rejects.toThrow(/mở khóa/i);
      expect(email.sendMany).not.toHaveBeenCalled();
    });

    it('cho phép gửi email cho ứng viên Săn đã mở khóa bằng Credit', async () => {
      jobs.requireOwnedJob.mockResolvedValue({ id: 'job-1', title: 'Kỹ sư PLC', company: { name: 'ABC' } });
      email.sendMany.mockResolvedValue({ sent: 1, failed: 0 });
      const prisma = {
        application: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'app-1',
              tenantId: 'default',
              candidateId: 'cand-unlocked',
              candidate: { displayName: 'A', user: { email: 'a@abc.com' } },
            },
          ]),
        },
        huntCampaign: {
          findMany: jest.fn().mockResolvedValue([{ jobId: 'job-1' }]),
        },
        billingCreditTransaction: {
          findMany: jest.fn().mockResolvedValue([{ candidateId: 'cand-unlocked' }]),
        },
        candidateConnection: { findMany: jest.fn().mockResolvedValue([]) },
        applicationTimeline: { createMany: jest.fn() },
      };
      const service = buildService(prisma);

      const result = await service.broadcastEmail(
        recruiterUser,
        'job-1',
        { subject: 'Thông báo', body: 'Nội dung email' },
        'corr-unlocked',
      );

      expect(result.sent).toBe(1);
      expect(result.skippedByPaywall).toBe(0);
      expect(email.sendMany).toHaveBeenCalled();
    });

    it('lấy nội dung AI khi trả JSON, và dùng bản nháp khi AI lỗi', async () => {
      jobs.requireOwnedJob.mockResolvedValue({
        id: 'job-1',
        title: 'Kỹ sư PLC',
        company: { name: 'ABC' },
      });
      const service = buildService({});
      ai.chat.mockResolvedValue('```json\n{"subject":"Cập nhật hồ sơ PLC - ABC","body":"Hồ sơ đang được xem xét theo quy trình."}\n```');

      const drafted = await service.suggestBroadcastEmail(recruiterUser, 'job-1', {
        purpose: 'progress',
        statuses: [ApplicationStatus.Screening],
      });
      expect(drafted.subject).toBe('Cập nhật hồ sơ PLC');
      expect(drafted.body).toContain('quy trình');

      ai.chat.mockRejectedValue(new Error('offline'));
      const fallback = await service.suggestBroadcastEmail(recruiterUser, 'job-1', {
        purpose: 'interview',
        statuses: [ApplicationStatus.Interview],
      });
      expect(fallback.subject).toContain('Kỹ sư PLC');
      expect(fallback.body).toContain('Lịch cụ thể');
    });
  });
});
