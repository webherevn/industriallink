import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, OfferStatus } from '@industriallink/contracts';
import { OfferService } from './offer.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('OfferService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('OFR-2026-000001') };
  const companies = {
    requireUserCompany: jest.fn().mockResolvedValue({ companyId: 'co-1', companyName: 'ABC' }),
  };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    companies.requireUserCompany.mockClear();
    return new OfferService(prisma as never, codeGen as never, events as never, audit as never, companies as never);
  }

  const recruiter: AuthenticatedUser = {
    id: 'user-r-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  const candidateUser: AuthenticatedUser = {
    id: 'user-c-1',
    email: 'c@abc.com',
    role: 'candidate' as never,
    tenantId: 'default',
    displayName: 'Ứng viên A',
    status: 'active',
  };

  function txStub() {
    return {
      offer: {
        create: jest.fn().mockResolvedValue({
          id: 'ofr-1',
          code: 'OFR-2026-000001',
          applicationId: 'app-1',
          jobId: 'job-1',
          candidateId: 'can-1',
          status: OfferStatus.Pending,
          salary: 20000000,
          currency: 'VND',
          startDate: null,
          expiresAt: null,
          benefits: null,
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

  describe('create', () => {
    it('gửi offer thành công, chuyển hồ sơ sang Đề nghị', async () => {
      const tx = txStub();
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: ApplicationStatus.Interview,
            isDeleted: false,
            job: { id: 'job-1', title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'Ứng viên A' },
          }),
        },
        offer: { findFirst: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      };
      const service = buildService(prisma);

      const result = await service.create(recruiter, { applicationId: 'app-1', salary: 20000000 }, 'corr-1');

      expect(result.code).toBe('OFR-2026-000001');
      expect(tx.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Offer, updatedBy: recruiter.id } }),
      );
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('recruitment.OfferSent.v1');
      expect(eventNames).toContain('recruitment.ApplicationStatusChanged.v1');
    });

    it('từ chối nếu đã có offer đang chờ phản hồi', async () => {
      const prisma = {
        application: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'app-1',
            status: ApplicationStatus.Interview,
            isDeleted: false,
            job: { id: 'job-1', title: 'X', companyId: 'co-1' },
            candidate: { id: 'can-1', displayName: 'A' },
          }),
        },
        offer: { findFirst: jest.fn().mockResolvedValue({ id: 'ofr-existing' }) },
      };
      const service = buildService(prisma);

      await expect(
        service.create(recruiter, { applicationId: 'app-1', salary: 20000000 }, 'corr-2'),
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
        service.create(recruiter, { applicationId: 'app-1', salary: 20000000 }, 'corr-3'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném NotFoundException nếu hồ sơ không tồn tại', async () => {
      const prisma = { application: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.create(recruiter, { applicationId: 'missing', salary: 20000000 }, 'corr-4'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('chấp nhận offer → tự chuyển hồ sơ sang Trúng tuyển', async () => {
      const timelineCreate = jest.fn().mockResolvedValue({});
      const appUpdate = jest.fn().mockResolvedValue({});
      const prisma = {
        offer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ofr-1',
            applicationId: 'app-1',
            isDeleted: false,
            job: { title: 'Kỹ sư PLC', companyId: 'co-1' },
            candidate: { displayName: 'A' },
          }),
          update: jest.fn().mockResolvedValue({
            id: 'ofr-1',
            code: 'OFR-1',
            applicationId: 'app-1',
            jobId: 'job-1',
            candidateId: 'can-1',
            status: OfferStatus.Accepted,
            salary: 20000000,
            currency: 'VND',
            startDate: null,
            expiresAt: null,
            benefits: null,
            notes: null,
            createdAt: new Date(),
            job: { title: 'Kỹ sư PLC' },
            candidate: { displayName: 'A' },
          }),
        },
        applicationTimeline: { create: timelineCreate },
        application: { update: appUpdate },
      };
      const service = buildService(prisma);

      const result = await service.update(recruiter, 'ofr-1', { status: OfferStatus.Accepted }, 'corr-5');

      expect(result.status).toBe(OfferStatus.Accepted);
      expect(appUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Hired, updatedBy: recruiter.id } }),
      );
    });

    it('ném ForbiddenException nếu offer không thuộc công ty của NTD', async () => {
      const prisma = {
        offer: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ofr-1',
            isDeleted: false,
            job: { title: 'X', companyId: 'co-OTHER' },
            candidate: { displayName: 'A' },
          }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.update(recruiter, 'ofr-1', { status: OfferStatus.Withdrawn }, 'corr-6'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('respond', () => {
    function offerStub(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'ofr-1',
        code: 'OFR-2026-000001',
        applicationId: 'app-1',
        jobId: 'job-1',
        candidateId: 'can-1',
        status: OfferStatus.Pending,
        isDeleted: false,
        salary: 20000000,
        currency: 'VND',
        startDate: null,
        expiresAt: null,
        benefits: null,
        notes: null,
        createdAt: new Date('2026-07-15T00:00:00.000Z'),
        job: { title: 'Kỹ sư PLC' },
        candidate: { displayName: 'Ứng viên A' },
        ...overrides,
      };
    }

    function buildRespondPrisma(existing: Record<string, unknown>, updated: Record<string, unknown>) {
      const tx = {
        offer: { update: jest.fn().mockResolvedValue(updated) },
        applicationTimeline: { create: jest.fn().mockResolvedValue({}) },
        application: { update: jest.fn().mockResolvedValue({}) },
      };
      return {
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        offer: { findUnique: jest.fn().mockResolvedValue(existing) },
        $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
        __tx: tx,
      };
    }

    it('chấp nhận offer → application chuyển sang Hired', async () => {
      const existing = offerStub();
      const updated = offerStub({ status: OfferStatus.Accepted });
      const prisma = buildRespondPrisma(existing, updated);
      const service = buildService(prisma);

      const result = await service.respond(candidateUser, 'ofr-1', { status: OfferStatus.Accepted }, 'corr-7');

      expect(result.status).toBe(OfferStatus.Accepted);
      expect(prisma.__tx.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Hired, updatedBy: candidateUser.id } }),
      );
      const eventNames = events.publish.mock.calls.map((c) => c[0].name);
      expect(eventNames).toContain('recruitment.OfferUpdated.v1');
    });

    it('từ chối offer → application chuyển sang Withdrawn', async () => {
      const existing = offerStub();
      const updated = offerStub({ status: OfferStatus.Declined });
      const prisma = buildRespondPrisma(existing, updated);
      const service = buildService(prisma);

      const result = await service.respond(candidateUser, 'ofr-1', { status: OfferStatus.Declined }, 'corr-8');

      expect(result.status).toBe(OfferStatus.Declined);
      expect(prisma.__tx.application.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApplicationStatus.Withdrawn, updatedBy: candidateUser.id } }),
      );
    });

    it('ném BadRequestException nếu user không có hồ sơ ứng viên', async () => {
      const prisma = { candidate: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(
        service.respond(candidateUser, 'ofr-1', { status: OfferStatus.Accepted }, 'corr-9'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném ForbiddenException nếu offer không thuộc về ứng viên', async () => {
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        offer: { findUnique: jest.fn().mockResolvedValue(offerStub({ candidateId: 'can-OTHER' })) },
      };
      const service = buildService(prisma);

      await expect(
        service.respond(candidateUser, 'ofr-1', { status: OfferStatus.Accepted }, 'corr-10'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném BadRequestException nếu offer đã được phản hồi trước đó', async () => {
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        offer: { findUnique: jest.fn().mockResolvedValue(offerStub({ status: OfferStatus.Accepted })) },
      };
      const service = buildService(prisma);

      await expect(
        service.respond(candidateUser, 'ofr-1', { status: OfferStatus.Declined }, 'corr-11'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném NotFoundException nếu không tìm thấy offer', async () => {
      const prisma = {
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        offer: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      await expect(
        service.respond(candidateUser, 'missing', { status: OfferStatus.Accepted }, 'corr-12'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
