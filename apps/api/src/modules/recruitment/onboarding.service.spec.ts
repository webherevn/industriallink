import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, OnboardingStatus } from '@industriallink/contracts';
import { OnboardingService } from './onboarding.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('OnboardingService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('ONB-2026-000001') };
  const companies = {
    requireUserCompany: jest.fn().mockResolvedValue({ companyId: 'co-1', companyName: 'ABC' }),
  };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    companies.requireUserCompany.mockClear();
    return new OnboardingService(
      prisma as never,
      codeGen as never,
      events as never,
      audit as never,
      companies as never,
    );
  }

  const recruiter: AuthenticatedUser = {
    id: 'user-r-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  function txStub() {
    return {
      onboarding: {
        create: jest.fn().mockResolvedValue({
          id: 'onb-1',
          code: 'ONB-2026-000001',
          applicationId: 'app-1',
          jobId: 'job-1',
          candidateId: 'can-1',
          status: OnboardingStatus.Pending,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          reportLocation: null,
          contactName: null,
          contactPhone: null,
          checklist: null,
          notes: null,
          createdAt: new Date('2026-07-15T00:00:00.000Z'),
          job: { title: 'Kỹ sư PLC' },
          candidate: { displayName: 'Ứng viên A' },
        }),
      },
      applicationTimeline: { create: jest.fn().mockResolvedValue({}) },
      application: { update: jest.fn().mockResolvedValue({}) },
    };
  }

  describe('start', () => {
    it('bắt đầu nhận việc thành công, chuyển hồ sơ sang Trúng tuyển', async () => {
      const tx = txStub();
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: ApplicationStatus.Offer,
            isDeleted: false,
            job: { id: 'job-1', title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'Ứng viên A' },
          }),
        },
        onboarding: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      };
      const service = buildService(prisma);

      const result = await service.start(
        recruiter,
        { applicationId: 'app-1', startDate: '2026-08-01' },
        'corr-1',
      );

      expect(result.code).toBe('ONB-2026-000001');
      expect(tx.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Hired, updatedBy: recruiter.id } }),
      );
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('recruitment.OnboardingStarted.v1');
      expect(eventNames).toContain('recruitment.ApplicationStatusChanged.v1');
    });

    it('từ chối nếu đã có quy trình nhận việc đang mở', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            status: ApplicationStatus.Offer,
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'A' },
          }),
        },
        onboarding: { findFirst: jest.fn().mockResolvedValue({ id: 'onb-existing' }) },
      };
      const service = buildService(prisma);

      await expect(
        service.start(recruiter, { applicationId: 'app-1', startDate: '2026-08-01' }, 'corr-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném BadRequestException nếu ngày nhận việc không hợp lệ', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            status: ApplicationStatus.Offer,
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'A' },
          }),
        },
        onboarding: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      await expect(
        service.start(recruiter, { applicationId: 'app-1', startDate: 'invalid-date' }, 'corr-3'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném ForbiddenException nếu hồ sơ không thuộc công ty của NTD', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-OTHER' },
            candidate: { id: 'can-1', displayName: 'A' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.start(recruiter, { applicationId: 'app-1', startDate: '2026-08-01' }, 'corr-4'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném NotFoundException nếu hồ sơ không tồn tại', async () => {
      const prisma = { application: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.start(recruiter, { applicationId: 'missing', startDate: '2026-08-01' }, 'corr-5'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('cập nhật trạng thái và ghi timeline', async () => {
      const timelineCreate = jest.fn().mockResolvedValue({});
      const prisma = {
        onboarding: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'onb-1',
            applicationId: 'app-1',
            isDeleted: false,
            job: { title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { displayName: 'A' },
          }),
          update: jest.fn().mockResolvedValue({
            id: 'onb-1',
            code: 'ONB-1',
            applicationId: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: OnboardingStatus.Completed,
            startDate: new Date('2026-08-01T00:00:00.000Z'),
            reportLocation: null,
            contactName: null,
            contactPhone: null,
            checklist: null,
            notes: null,
            createdAt: new Date(),
            job: { title: 'Kỹ sư PLC' },
            candidate: { displayName: 'A' },
          }),
        },
        applicationTimeline: { create: timelineCreate },
      };
      const service = buildService(prisma);

      const result = await service.update(
        recruiter,
        'onb-1',
        { status: OnboardingStatus.Completed },
        'corr-6',
      );

      expect(result.status).toBe(OnboardingStatus.Completed);
      expect(timelineCreate).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledTimes(1);
    });

    it('ném ForbiddenException nếu onboarding không thuộc công ty của NTD', async () => {
      const prisma = {
        onboarding: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'onb-1',
            isDeleted: false,
            job: { title: 'X', companyId: 'co-OTHER' },
            candidate: { displayName: 'A' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.update(recruiter, 'onb-1', { status: OnboardingStatus.Cancelled }, 'corr-7'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném NotFoundException nếu onboarding không tồn tại', async () => {
      const prisma = { onboarding: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.update(recruiter, 'missing', { status: OnboardingStatus.Cancelled }, 'corr-8'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
