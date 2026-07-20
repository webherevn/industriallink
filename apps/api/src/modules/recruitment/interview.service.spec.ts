import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, InterviewStatus, InterviewType } from '@industriallink/contracts';
import { InterviewService } from './interview.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('InterviewService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('INT-2026-000001') };
  const companies = {
    requireUserCompany: jest.fn().mockResolvedValue({ companyId: 'co-1', companyName: 'ABC' }),
  };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    companies.requireUserCompany.mockClear();
    return new InterviewService(prisma as never, codeGen as never, events as never, audit as never, companies as never);
  }

  const recruiter: AuthenticatedUser = {
    id: 'user-r-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  function txStub(overrides: Record<string, unknown> = {}) {
    return {
      interview: {
        create: jest.fn().mockResolvedValue({
          id: 'iv-1',
          code: 'INT-2026-000001',
          applicationId: 'app-1',
          jobId: 'job-1',
          candidateId: 'can-1',
          type: InterviewType.Hr,
          status: InterviewStatus.Scheduled,
          scheduledAt: new Date('2026-07-20T09:00:00.000Z'),
          durationMinutes: 60,
          meetingLink: null,
          location: null,
          interviewerName: null,
          notes: null,
          createdAt: new Date('2026-07-15T00:00:00.000Z'),
          job: { title: 'Kỹ sư PLC' },
          candidate: { displayName: 'Ứng viên A' },
        }),
      },
      applicationTimeline: { create: jest.fn().mockResolvedValue({}) },
      application: { update: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
  }

  describe('schedule', () => {
    it('đặt lịch PV thành công, chuyển hồ sơ sang Phỏng vấn', async () => {
      const tx = txStub();
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: ApplicationStatus.Applied,
            isDeleted: false,
            job: { id: 'job-1', title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'Ứng viên A', userId: 'cu-1' },
          }),
        },
        $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      };
      const service = buildService(prisma);

      const result = await service.schedule(
        recruiter,
        {
          applicationId: 'app-1',
          type: InterviewType.Hr,
          scheduledAt: '2026-07-20T09:00:00.000Z',
        },
        'corr-1',
      );

      expect(result.code).toBe('INT-2026-000001');
      expect(tx.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Interview, updatedBy: recruiter.id } }),
      );
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('recruitment.InterviewScheduled.v1');
      expect(eventNames).toContain('recruitment.ApplicationStatusChanged.v1');
    });

    it('không chuyển trạng thái nếu hồ sơ đã Hired/Rejected', async () => {
      const tx = txStub();
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: ApplicationStatus.Hired,
            isDeleted: false,
            job: { id: 'job-1', title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'Ứng viên A', userId: 'cu-1' },
          }),
        },
        $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      };
      const service = buildService(prisma);

      await service.schedule(
        recruiter,
        { applicationId: 'app-1', type: InterviewType.Hr, scheduledAt: '2026-07-20T09:00:00.000Z' },
        'corr-2',
      );

      expect(tx.application.update).not.toHaveBeenCalled();
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).not.toContain('recruitment.ApplicationStatusChanged.v1');
    });

    it('ném ForbiddenException nếu hồ sơ không thuộc công ty của NTD', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-OTHER' },
            candidate: { id: 'can-1', displayName: 'A', userId: 'cu-1' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.schedule(
          recruiter,
          { applicationId: 'app-1', type: InterviewType.Hr, scheduledAt: '2026-07-20T09:00:00.000Z' },
          'corr-3',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném BadRequestException nếu thời gian không hợp lệ', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'A', userId: 'cu-1' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.schedule(
          recruiter,
          { applicationId: 'app-1', type: InterviewType.Hr, scheduledAt: 'not-a-date' },
          'corr-4',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném NotFoundException nếu hồ sơ không tồn tại', async () => {
      const prisma = { application: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.schedule(
          recruiter,
          { applicationId: 'missing', type: InterviewType.Hr, scheduledAt: '2026-07-20T09:00:00.000Z' },
          'corr-5',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('ném ForbiddenException nếu lịch PV không thuộc công ty của NTD', async () => {
      const prisma = {
        interview: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'iv-1',
            isDeleted: false,
            job: { title: 'X', companyId: 'co-OTHER' },
            candidate: { displayName: 'A' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.update(recruiter, 'iv-1', { status: InterviewStatus.Cancelled }, 'corr-6'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cập nhật và ghi timeline khi huỷ lịch', async () => {
      const create = jest.fn().mockResolvedValue({});
      const prisma = {
        interview: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'iv-1',
            applicationId: 'app-1',
            isDeleted: false,
            job: { title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { displayName: 'A' },
          }),
          update: jest.fn().mockResolvedValue({
            id: 'iv-1',
            code: 'INT-1',
            applicationId: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            type: InterviewType.Hr,
            status: InterviewStatus.Cancelled,
            scheduledAt: new Date('2026-07-20T09:00:00.000Z'),
            durationMinutes: 60,
            meetingLink: null,
            location: null,
            interviewerName: null,
            notes: null,
            createdAt: new Date(),
            job: { title: 'Kỹ sư PLC' },
            candidate: { displayName: 'A' },
          }),
        },
        applicationTimeline: { create },
      };
      const service = buildService(prisma);

      const result = await service.update(
        recruiter,
        'iv-1',
        { status: InterviewStatus.Cancelled },
        'corr-7',
      );

      expect(result.status).toBe(InterviewStatus.Cancelled);
      expect(create).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('statsForCompany', () => {
    it('tính đúng số buổi hôm nay theo loại', async () => {
      const now = new Date();
      const soon = new Date(now.getTime() + 30 * 60 * 1000);
      const prisma = {
        interview: {
          findMany: jest.fn().mockResolvedValue([
            { type: InterviewType.Hr, scheduledAt: soon },
            { type: InterviewType.Technical, scheduledAt: soon },
            { type: InterviewType.Other, scheduledAt: new Date(now.getTime() + 5 * 60 * 60 * 1000) },
          ]),
        },
      };
      const service = buildService(prisma);

      const stats = await service.statsForCompany(recruiter);
      expect(stats.todayCount).toBe(3);
      expect(stats.next2hCount).toBe(2);
      expect(stats.byType).toEqual({ hr: 1, technical: 1, other: 1 });
    });
  });
});
