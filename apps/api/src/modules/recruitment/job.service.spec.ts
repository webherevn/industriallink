import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@industriallink/contracts';
import { JobService } from './job.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('JobService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('JOB-2026-000001') };
  const skills = { resolveSkillId: jest.fn().mockResolvedValue('skill-1') };
  const companies = {
    requireUserCompany: jest
      .fn()
      .mockResolvedValue({ companyId: 'co-1', companyName: 'Công ty ABC' }),
  };
  const ai = {
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateJobDraft: jest.fn(),
    estimateSalary: jest.fn(),
  };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    skills.resolveSkillId.mockClear();
    companies.requireUserCompany.mockClear();
    ai.embed.mockClear();
    ai.generateJobDraft.mockClear();
    ai.estimateSalary.mockClear();
    return new JobService(
      prisma as never,
      codeGen as never,
      events as never,
      audit as never,
      skills as never,
      companies as never,
      ai as never,
    );
  }

  const recruiter: AuthenticatedUser = {
    id: 'user-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  const baseJobRow = {
    id: 'job-1',
    tenantId: 'default',
    code: 'JOB-2026-000001',
    companyId: 'co-1',
    title: 'Kỹ sư PLC',
    description: 'Vận hành và bảo trì hệ thống PLC nhà máy',
    requirements: null,
    benefits: null,
    industry: null,
    department: null,
    jobLevel: null,
    employmentType: null,
    location: null,
    headcount: 1,
    deadline: null,
    experienceBand: null,
    salaryMin: null,
    salaryMax: null,
    status: JobStatus.Draft,
    isDeleted: false,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    skills: [],
    company: { id: 'co-1', name: 'Công ty ABC' },
  };

  describe('createJob', () => {
    it('tạo tin ở trạng thái Nháp, không gọi embedding khi publish=false', async () => {
      const create = jest.fn().mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft });
      const prisma = { job: { create }, $executeRaw: jest.fn() };
      const service = buildService(prisma);

      const result = await service.createJob(
        recruiter,
        { title: 'Kỹ sư PLC', description: 'Vận hành và bảo trì hệ thống PLC nhà máy', publish: false },
        'corr-1',
      );

      expect(result.status).toBe(JobStatus.Draft);
      expect(ai.embed).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('tạo và đăng công khai ngay khi publish=true → sinh embedding + phát JobPublished', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ ...baseJobRow, status: JobStatus.Published, publishedAt: new Date() });
      const executeRaw = jest.fn().mockResolvedValue(undefined);
      const prisma = { job: { create }, $executeRaw: executeRaw };
      const service = buildService(prisma);

      const result = await service.createJob(
        recruiter,
        {
          title: 'Kỹ sư PLC',
          description: 'Vận hành và bảo trì hệ thống PLC nhà máy',
          publish: true,
          skills: [{ name: 'PLC Siemens', required: true, weight: 2 }],
        },
        'corr-2',
      );

      expect(result.status).toBe(JobStatus.Published);
      expect(skills.resolveSkillId).toHaveBeenCalledWith('PLC Siemens');
      expect(ai.embed).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledTimes(1);
      const published = events.publish.mock.calls[0][0];
      expect(published.name).toBe('recruitment.JobPublished.v1');
    });

    it('vẫn tạo được tin dù embedding lỗi (bỏ qua, không throw)', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ ...baseJobRow, status: JobStatus.Published, publishedAt: new Date() });
      ai.embed.mockRejectedValueOnce(new Error('AI down'));
      const prisma = { job: { create }, $executeRaw: jest.fn() };
      const service = buildService(prisma);

      await expect(
        service.createJob(
          recruiter,
          { title: 'Kỹ sư PLC', description: 'Vận hành và bảo trì hệ thống PLC nhà máy', publish: true },
          'corr-3',
        ),
      ).resolves.toBeDefined();
      expect(events.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishJob', () => {
    it('không làm gì thêm nếu tin đã Published', async () => {
      const prisma = {
        job: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ ...baseJobRow, status: JobStatus.Published }),
          update: jest.fn(),
        },
        candidate: { findUnique: jest.fn() },
      };
      const service = buildService(prisma);

      const result = await service.publishJob(recruiter, 'job-1', 'corr-4');

      expect(result.status).toBe(JobStatus.Published);
      expect(prisma.job.update).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('chuyển tin từ Nháp sang Published và phát sự kiện', async () => {
      const update = jest
        .fn()
        .mockResolvedValue({ ...baseJobRow, status: JobStatus.Published });
      const prisma = {
        job: {
          findUnique: jest.fn().mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft }),
          update,
        },
        $executeRaw: jest.fn(),
      };
      const service = buildService(prisma);

      const result = await service.publishJob(recruiter, 'job-1', 'corr-5');

      expect(result.status).toBe(JobStatus.Published);
      expect(update).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireOwnedJob', () => {
    it('ném NotFoundException nếu tin không tồn tại hoặc đã xoá', async () => {
      const prisma = { job: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.requireOwnedJob(recruiter, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('ném ForbiddenException nếu tin không thuộc công ty của user', async () => {
      const prisma = {
        job: {
          findUnique: jest.fn().mockResolvedValue({ ...baseJobRow, companyId: 'co-OTHER' }),
        },
      };
      const service = buildService(prisma);

      await expect(service.requireOwnedJob(recruiter, 'job-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('trả về tin nếu thuộc đúng công ty', async () => {
      const prisma = { job: { findUnique: jest.fn().mockResolvedValue(baseJobRow) } };
      const service = buildService(prisma);

      const job = await service.requireOwnedJob(recruiter, 'job-1');
      expect(job.id).toBe('job-1');
    });
  });

  describe('getJob', () => {
    it('đánh dấu hasApplied=true nếu ứng viên đã ứng tuyển', async () => {
      const prisma = {
        job: { findUnique: jest.fn().mockResolvedValue(baseJobRow) },
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        application: { findUnique: jest.fn().mockResolvedValue({ id: 'app-1' }) },
      };
      const service = buildService(prisma);

      const view = await service.getJob('job-1', recruiter);
      expect(view.hasApplied).toBe(true);
    });

    it('ném NotFoundException nếu tin không tồn tại', async () => {
      const prisma = { job: { findUnique: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.getJob('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('generateJobDraft / estimateSalary', () => {
    it('generateJobDraft gọi AI Gateway và ghi audit', async () => {
      ai.generateJobDraft.mockResolvedValue({
        title: 'Kỹ sư PLC',
        description: 'Mô tả AI',
        requirements: 'Yêu cầu AI',
        benefits: 'Phúc lợi AI',
        skills: [{ name: 'PLC', required: true }],
        suggestedSalaryMin: 15000000,
        suggestedSalaryMax: 25000000,
      });
      const prisma = {};
      const service = buildService(prisma);

      const draft = await service.generateJobDraft(recruiter, { title: 'Kỹ sư PLC' }, 'corr-6');

      expect(draft.title).toBe('Kỹ sư PLC');
      expect(audit.record).toHaveBeenCalledTimes(1);
    });

    it('estimateSalary chuyển tiếp qua AI Gateway', async () => {
      ai.estimateSalary.mockResolvedValue({
        jobLevel: 'tech_staff',
        jobLevelLabel: 'Nhân viên kỹ thuật',
        track: 'technical',
        trackLabel: 'Kỹ thuật',
        salaryMin: 10000000,
        salaryMax: 20000000,
        median: 15000000,
        currency: 'VND',
        factors: [],
        notes: '',
      });
      const service = buildService({});

      const result = await service.estimateSalary({ jobLevel: 'tech_staff' } as never);
      expect(ai.estimateSalary).toHaveBeenCalledTimes(1);
      expect(result.salaryMin).toBe(10000000);
    });
  });

  describe('listPublishedJobs', () => {
    it('lọc theo industry, experienceBand, jobTrack và trả skills + isNew', async () => {
      const publishedAt = new Date();
      const findMany = jest.fn().mockResolvedValue([
        {
          ...baseJobRow,
          status: JobStatus.Published,
          industry: 'Máy móc & Thiết bị công nghiệp',
          jobLevel: 'sales.staff',
          experienceBand: '1_3',
          publishedAt,
          skills: [{ name: 'Technical Sales' }],
        },
      ]);
      const prisma = {
        job: { findMany },
        jobBookmark: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = buildService(prisma);

      const result = await service.listPublishedJobs({
        industry: 'Máy móc & Thiết bị công nghiệp',
        experienceBand: '1_3',
        jobTrack: 'sales',
        userId: 'user-c-1',
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: JobStatus.Published,
            industry: { equals: 'Máy móc & Thiết bị công nghiệp', mode: 'insensitive' },
            experienceBand: '1_3',
            jobLevel: { startsWith: 'sales.' },
          }),
        }),
      );
      expect(result[0].skills).toEqual(['Technical Sales']);
      expect(result[0].isNew).toBe(true);
      expect(result[0].experienceBand).toBe('1_3');
    });
  });

  describe('bookmark', () => {
    it('addBookmark upsert theo userId+jobId', async () => {
      const upsert = jest.fn().mockResolvedValue({});
      const prisma = {
        job: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseJobRow,
            status: JobStatus.Published,
            isDeleted: false,
          }),
        },
        jobBookmark: { upsert },
      };
      const service = buildService(prisma);
      const candidate: AuthenticatedUser = { ...recruiter, id: 'user-c-1', role: 'candidate' as never };

      await expect(service.addBookmark(candidate, 'job-1')).resolves.toEqual({ ok: true });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_jobId: { userId: 'user-c-1', jobId: 'job-1' } },
        }),
      );
    });
  });
});
