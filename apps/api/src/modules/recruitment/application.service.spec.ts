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

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    jobs.requireOwnedJob.mockClear();
    matching.computePairMatch.mockClear();
    companies.requireUserCompany.mockClear();
    email.sendMany.mockClear();
    return new ApplicationService(
      prisma as never,
      codeGen as never,
      events as never,
      audit as never,
      jobs as never,
      matching as never,
      companies as never,
      email as never,
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
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1', tenantId: 'default' }) },
        job: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'job-1',
            code: 'JOB-1',
            title: 'Kỹ sư PLC',
            status: JobStatus.Published,
            isDeleted: false,
            company: { name: 'Công ty ABC' },
          }),
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
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1', tenantId: 'default' }) },
        job: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'job-1',
            status: JobStatus.Draft,
            isDeleted: false,
            company: { name: 'Công ty ABC' },
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
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1', tenantId: 'default' }) },
        job: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'job-1',
            status: JobStatus.Published,
            isDeleted: false,
            company: { name: 'Công ty ABC' },
          }),
        },
        application: { findUnique: jest.fn().mockResolvedValue({ id: 'app-existing' }) },
      };
      const service = buildService(prisma);

      await expect(service.apply(candidateUser, 'job-1', {}, 'corr-4')).rejects.toBeInstanceOf(
        BadRequestException,
      );
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
              candidate: { displayName: 'A', user: { email: 'a@abc.com' } },
            },
            {
              id: 'app-2',
              tenantId: 'default',
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

      expect(result).toEqual({ recipients: 2, sent: 2, failed: 0 });
      expect(createMany).toHaveBeenCalledTimes(1);
    });
  });
});
