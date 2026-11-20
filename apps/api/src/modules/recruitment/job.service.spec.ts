import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    assertCompanyCanPost: jest.fn().mockResolvedValue(undefined),
  };
  const billing = {
    assertJobQuota: jest.fn().mockResolvedValue(undefined),
    pickJobPackageForPosting: jest.fn().mockResolvedValue(null),
    activateJobPackageInTx: jest.fn().mockResolvedValue({
      expiresAt: null,
      displayDeadline: null,
    }),
    consumeJobPackageSlot: jest.fn().mockResolvedValue(undefined),
    releaseJobPackageSlot: jest.fn().mockResolvedValue(undefined),
    getJobDisplayDays: jest.fn().mockResolvedValue(14),
    getJobDeadlineCeiling: jest.fn().mockResolvedValue(new Date('2026-07-15T00:00:00.000Z')),
    huntOwnedJobIds: jest.fn().mockResolvedValue(new Set<string>()),
  };
  const ai = {
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    generateJobDraft: jest.fn(),
    parseJobDescription: jest.fn(),
    estimateSalary: jest.fn(),
  };
  const indexing = { notifyJob: jest.fn().mockResolvedValue(undefined) };
  const moderationQueue = { add: jest.fn().mockResolvedValue(undefined) };

  /** Prisma mock có sẵn `$transaction` để hỗ trợ luồng tạo tin + trừ lượt gói. */
  function withTransaction(prisma: Record<string, unknown>): Record<string, unknown> {
    const tx = {
      job: (prisma as { job: Record<string, unknown> }).job,
      billingJobPackage: (prisma as { billingJobPackage?: Record<string, unknown> })
        .billingJobPackage,
    };
    return {
      ...prisma,
      $transaction: jest.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
    };
  }

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    skills.resolveSkillId.mockClear();
    companies.requireUserCompany.mockClear();
    billing.assertJobQuota.mockClear();
    billing.pickJobPackageForPosting.mockClear();
    billing.pickJobPackageForPosting.mockResolvedValue(null);
    billing.consumeJobPackageSlot.mockClear();
    billing.releaseJobPackageSlot.mockClear();
    billing.activateJobPackageInTx.mockClear();
    billing.activateJobPackageInTx.mockResolvedValue({
      expiresAt: null,
      displayDeadline: null,
    });
    billing.getJobDisplayDays.mockClear();
    billing.getJobDisplayDays.mockResolvedValue(14);
    billing.getJobDeadlineCeiling.mockClear();
    billing.getJobDeadlineCeiling.mockResolvedValue(new Date('2026-07-15T00:00:00.000Z'));
    billing.huntOwnedJobIds.mockClear();
    billing.huntOwnedJobIds.mockResolvedValue(new Set<string>());
    ai.embed.mockClear();
    ai.generateJobDraft.mockClear();
    ai.parseJobDescription.mockClear();
    ai.estimateSalary.mockClear();
    indexing.notifyJob.mockClear();
    moderationQueue.add.mockClear();
    return new JobService(
      prisma as never,
      codeGen as never,
      events as never,
      audit as never,
      skills as never,
      companies as never,
      billing as never,
      ai as never,
      indexing as never,
      moderationQueue as never,
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
    slug: 'ky-su-plc',
    tenantId: 'default',
    code: 'JOB-2026-000001',
    companyId: 'co-1',
    title: 'Kỹ sư PLC',
    description: 'Vận hành và bảo trì hệ thống PLC nhà máy',
    requirements: null,
    benefits: null,
    industry: null,
    subIndustry: null,
    department: null,
    jobLevel: null,
    employmentType: null,
    location: null,
    headcount: 1,
    deadline: null,
    experienceBand: null,
    salaryMin: null,
    salaryMax: null,
    jobTrack: null,
    salesCriteria: null,
    technicalCriteria: null,
    status: JobStatus.Draft,
    isDeleted: false,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    skills: [],
    publishedAt: null,
    company: {
      id: 'co-1',
      name: 'Công ty ABC',
      slug: 'cong-ty-abc',
      website: null,
      address: null,
      profile: null,
    },
  };

  describe('createJob', () => {
    it('tạo tin ở trạng thái Nháp, không gọi embedding khi publish=false', async () => {
      const create = jest.fn().mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft });
      const prisma = withTransaction({
        job: { create, findMany: jest.fn().mockResolvedValue([]) },
        company: { findUnique: jest.fn().mockResolvedValue({ name: 'Công ty ABC' }) },
        $executeRaw: jest.fn(),
      });
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

    it('publish=true → đưa vào hàng đợi kiểm duyệt, KHÔNG publish/embed trực tiếp', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft, moderationStatus: 'pending' });
      const executeRaw = jest.fn().mockResolvedValue(undefined);
      const prisma = withTransaction({
        job: { create, findMany: jest.fn().mockResolvedValue([]) },
        company: { findUnique: jest.fn().mockResolvedValue({ name: 'Công ty ABC' }) },
        $executeRaw: executeRaw,
      });
      const service = buildService(prisma);

      await service.createJob(
        recruiter,
        {
          title: 'Kỹ sư PLC',
          description: 'Vận hành và bảo trì hệ thống PLC nhà máy',
          publish: true,
          skills: [{ name: 'PLC Siemens', required: true, weight: 2 }],
        },
        'corr-2',
      );

      expect(skills.resolveSkillId).toHaveBeenCalledWith('PLC Siemens');
      // Không sinh embedding và không phát JobPublished tại thời điểm tạo.
      expect(ai.embed).not.toHaveBeenCalled();
      expect(moderationQueue.add).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledTimes(1);
      const submitted = events.publish.mock.calls[0][0];
      expect(submitted.name).toBe('recruitment.JobSubmittedForModeration.v1');
    });

    it('vẫn tạo được tin (nháp) mà không đưa vào hàng đợi khi publish=false', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft, moderationStatus: 'draft' });
      const prisma = withTransaction({
        job: { create, findMany: jest.fn().mockResolvedValue([]) },
        company: { findUnique: jest.fn().mockResolvedValue({ name: 'Công ty ABC' }) },
        $executeRaw: jest.fn(),
      });
      const service = buildService(prisma);

      await expect(
        service.createJob(
          recruiter,
          { title: 'Kỹ sư PLC', description: 'Vận hành và bảo trì hệ thống PLC nhà máy', publish: false },
          'corr-3',
        ),
      ).resolves.toBeDefined();
      expect(moderationQueue.add).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    });
  });

  describe('publishJob', () => {
    it('không làm gì thêm nếu tin đã Published', async () => {
      const prisma = {
        job: {
          findFirst: jest
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
          findFirst: jest.fn().mockResolvedValue({ ...baseJobRow, status: JobStatus.Draft }),
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
      const prisma = { job: { findFirst: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.requireOwnedJob(recruiter, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('ném ForbiddenException nếu tin không thuộc công ty của user', async () => {
      const prisma = {
        job: {
          findFirst: jest.fn().mockResolvedValue({ ...baseJobRow, companyId: 'co-OTHER' }),
        },
      };
      const service = buildService(prisma);

      await expect(service.requireOwnedJob(recruiter, 'job-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('trả về tin nếu thuộc đúng công ty', async () => {
      const prisma = { job: { findFirst: jest.fn().mockResolvedValue(baseJobRow) } };
      const service = buildService(prisma);

      const job = await service.requireOwnedJob(recruiter, 'job-1');
      expect(job.id).toBe('job-1');
    });
  });

  describe('getJob', () => {
    it('đánh dấu hasApplied=true nếu ứng viên đã ứng tuyển', async () => {
      const prisma = {
        job: { findFirst: jest.fn().mockResolvedValue(baseJobRow) },
        candidate: { findUnique: jest.fn().mockResolvedValue({ id: 'can-1' }) },
        application: { findUnique: jest.fn().mockResolvedValue({ id: 'app-1' }) },
        huntCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      const view = await service.getJob('job-1', recruiter);
      expect(view.hasApplied).toBe(true);
    });

    it('ném NotFoundException nếu tin không tồn tại', async () => {
      const prisma = { job: { findFirst: jest.fn().mockResolvedValue(null) } };
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
          industry: 'Máy móc & Thiết bị sản xuất',
          jobLevel: 'sales.staff',
          experienceBand: '1_3',
          publishedAt,
          skills: [{ name: 'Technical Sales' }],
        },
      ]);
      const prisma = {
        job: { findMany },
        jobBookmark: { findMany: jest.fn().mockResolvedValue([]) },
        billingCompanyPlan: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = buildService(prisma);

      const result = await service.listPublishedJobs({
        industry: 'Máy móc & Thiết bị sản xuất',
        experienceBand: '1_3',
        jobTrack: 'sales',
        userId: 'user-c-1',
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: JobStatus.Published,
            experienceBand: '1_3',
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { jobTrack: 'sales' },
                  { jobLevel: { startsWith: 'sales.' } },
                ]),
              }),
            ]),
          }),
        }),
      );
      expect(result[0].skills).toEqual(['Technical Sales']);
      expect(result[0].isNew).toBe(true);
      expect(result[0].experienceBand).toBe('1_3');
    });
  });

  describe('listPublishedPositionStats', () => {
    it('gom tiêu đề tin published theo ngành', async () => {
      const findMany = jest.fn().mockResolvedValue([
        { title: 'Kỹ sư PLC / Tự động hóa', industry: 'Tự động hóa & Điều khiển' },
        { title: 'Kỹ sư PLC / Tự động hóa', industry: 'Tự động hóa & Điều khiển' },
        { title: 'Kỹ sư kinh doanh – Máy nén khí', industry: 'Máy móc & Thiết bị sản xuất' },
      ]);
      const service = buildService({ job: { findMany } });
      const result = await service.listPublishedPositionStats();
      expect(result.popular[0]).toEqual({ title: 'Kỹ sư PLC / Tự động hóa', count: 2 });
      expect(result.keywords[0]).toBe('Kỹ sư PLC');
      expect(result.keywords).toEqual(expect.arrayContaining(['Kỹ sư PLC', 'Tự động hóa', 'Kỹ sư kinh doanh']));
      expect(result.keywords).not.toContain('Máy nén khí');
      expect(result.byIndustry).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            industry: 'Tự động hóa & Điều khiển',
            positions: [{ title: 'Kỹ sư PLC / Tự động hóa', count: 2 }],
          }),
        ]),
      );
    });
  });

  describe('submitForModeration — lượt đăng gói', () => {
    it('trừ 1 lượt đăng khi nộp lại tin đã bị từ chối kiểm duyệt', async () => {
      const update = jest.fn().mockResolvedValue({ ...baseJobRow });
      const prisma = withTransaction({
        job: {
          findFirst: jest.fn().mockResolvedValue({
            ...baseJobRow,
            status: JobStatus.Draft,
            moderationStatus: 'rejected_auto',
            jobPackageId: 'pkg-1',
          }),
          update,
        },
      });
      const service = buildService(prisma);

      await service.submitForModeration(recruiter, 'job-1', 'corr-reject-1');

      expect(billing.consumeJobPackageSlot).toHaveBeenCalledTimes(1);
      expect(billing.consumeJobPackageSlot).toHaveBeenCalledWith(expect.anything(), 'pkg-1');
      // KHÔNG cấp lại Credit (không gọi activateJobPackageInTx / pickJobPackageForPosting).
      expect(billing.pickJobPackageForPosting).not.toHaveBeenCalled();
    });

    it('KHÔNG trừ lượt khi tin chưa từng bị từ chối', async () => {
      const update = jest.fn().mockResolvedValue({ ...baseJobRow });
      const prisma = withTransaction({
        job: {
          findFirst: jest.fn().mockResolvedValue({
            ...baseJobRow,
            status: JobStatus.Draft,
            moderationStatus: 'draft',
            jobPackageId: 'pkg-1',
          }),
          update,
        },
      });
      const service = buildService(prisma);

      await service.submitForModeration(recruiter, 'job-1', 'corr-reject-2');

      expect(billing.consumeJobPackageSlot).not.toHaveBeenCalled();
    });

    it('chọn gói UNUSED và trừ lượt khi tin nháp chưa gắn gói', async () => {
      const update = jest.fn().mockResolvedValue({ ...baseJobRow });
      const prisma = withTransaction({
        job: {
          findFirst: jest.fn().mockResolvedValue({
            ...baseJobRow,
            status: JobStatus.Draft,
            moderationStatus: 'draft',
            jobPackageId: null,
          }),
          update,
        },
      });
      const service = buildService(prisma);
      billing.pickJobPackageForPosting.mockResolvedValue({
        id: 'pkg-new',
        code: 'JD-ST-1',
        planName: 'Gói tiêu chuẩn',
      });
      billing.activateJobPackageInTx.mockResolvedValue({
        expiresAt: new Date('2026-07-31T00:00:00.000Z'),
        displayDeadline: new Date('2026-07-31T00:00:00.000Z'),
      });

      await service.submitForModeration(recruiter, 'job-1', 'corr-reject-3');

      expect(billing.consumeJobPackageSlot).toHaveBeenCalledTimes(1);
      expect(billing.consumeJobPackageSlot).toHaveBeenCalledWith(expect.anything(), 'pkg-new');
    });
  });

  describe('deleteJob — không hoàn lượt đăng', () => {
    it('không gọi releaseJobPackageSlot khi NTD tự xoá tin', async () => {
      const prisma = withTransaction({
        job: {
          findFirst: jest.fn().mockResolvedValue({
            ...baseJobRow,
            status: JobStatus.Published,
            jobPackageId: 'pkg-1',
          }),
          update: jest.fn().mockResolvedValue({ ...baseJobRow }),
        },
        huntCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      const service = buildService(prisma);

      await service.deleteJob(recruiter, 'job-1', 'corr-del-1');

      expect(billing.releaseJobPackageSlot).not.toHaveBeenCalled();
    });
  });

  describe('updateJob — KHÓA CỨNG Vị trí & Cấp bậc khi chiến dịch Tin Săn active', () => {
    /** Prisma mock cho 1 tin đang có chiến dịch Săn (status ≠ closed). */
    function buildHuntPrisma(jobOverrides: Record<string, unknown> = {}) {
      const update = jest.fn().mockResolvedValue({ ...baseJobRow, ...jobOverrides });
      return {
        service: null as unknown as JobService,
        prisma: withTransaction({
          job: {
            findFirst: jest.fn().mockResolvedValue({ ...baseJobRow, ...jobOverrides }),
            update,
          },
          jobSkill: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          huntCampaign: { findFirst: jest.fn().mockResolvedValue({ id: 'camp-1' }) },
          jobHiringProcess: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          jobLocation: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        }),
        update,
      };
    }

    it('ném 400 khi cố đổi CẤP BẬC trong lúc chiến dịch Săn đang chạy', async () => {
      const ctx = buildHuntPrisma({ jobLevel: 'sales.staff', title: 'Nhân viên kinh doanh' });
      const service = buildService(ctx.prisma);

      await expect(
        service.updateJob(
          recruiter,
          'job-1',
          { title: 'Nhân viên kinh doanh', jobLevel: 'sales.manager' } as never,
          'corr-hunt-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ctx.update).not.toHaveBeenCalled();
    });

    it('ném 400 khi cố đổi CHỨC DANH (tiêu đề tin) trong lúc chiến dịch Săn đang chạy', async () => {
      const ctx = buildHuntPrisma({ jobLevel: 'sales.staff', title: 'Nhân viên kinh doanh' });
      const service = buildService(ctx.prisma);

      await expect(
        service.updateJob(
          recruiter,
          'job-1',
          { title: 'Giám đốc kinh doanh', jobLevel: 'sales.staff' } as never,
          'corr-hunt-2',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ctx.update).not.toHaveBeenCalled();
    });

    it('ném 400 khi cố đổi VỊ TRÍ trong technicalCriteria của track Kỹ thuật', async () => {
      const ctx = buildHuntPrisma({
        jobLevel: 'tech.engineer',
        title: 'Kỹ sư PLC',
        technicalCriteria: { position: 'Kỹ sư PLC' },
      });
      const service = buildService(ctx.prisma);

      await expect(
        service.updateJob(
          recruiter,
          'job-1',
          {
            title: 'Kỹ sư PLC',
            jobLevel: 'tech.engineer',
            technicalCriteria: { position: 'Giám đốc kỹ thuật' },
          } as never,
          'corr-hunt-3',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(ctx.update).not.toHaveBeenCalled();
    });

    it('CHO PHÉP điều chỉnh tiêu chí tối ưu phạm vi săn (lương, kinh nghiệm, khu vực)', async () => {
      const ctx = buildHuntPrisma({ jobLevel: 'sales.staff', title: 'Nhân viên kinh doanh' });
      const service = buildService(ctx.prisma);

      await service.updateJob(
        recruiter,
        'job-1',
        {
          title: 'Nhân viên kinh doanh',
          jobLevel: 'sales.staff',
          salaryMin: 15000000,
          salaryMax: 25000000,
          experienceBand: '3-5 năm',
          location: 'Hà Nội',
          fromSourcingRevision: true,
        } as never,
        'corr-hunt-4',
      );

      expect(ctx.update).toHaveBeenCalled();
      const payload = ctx.update.mock.calls[0][0].data;
      expect(payload.salaryMin).toBe(15000000);
      expect(payload.experienceBand).toBe('3-5 năm');
      expect(payload.location).toBe('Hà Nội');
    });

    it('KHÔNG khóa khi tin KHÔNG gắn chiến dịch Săn (sửa tin thường vẫn đổi cấp bậc được)', async () => {
      const ctx = buildHuntPrisma({ jobLevel: 'sales.staff', title: 'Nhân viên kinh doanh' });
      (ctx.prisma.huntCampaign as { findFirst: jest.Mock }).findFirst.mockResolvedValue(null);
      const service = buildService(ctx.prisma);

      await service.updateJob(
        recruiter,
        'job-1',
        { title: 'Nhân viên kinh doanh', jobLevel: 'sales.manager' } as never,
        'corr-hunt-5',
      );

      expect(ctx.update).toHaveBeenCalled();
    });
  });

  describe('bookmark', () => {
    it('addBookmark upsert theo userId+jobId', async () => {
      const upsert = jest.fn().mockResolvedValue({});
      const prisma = {
        job: {
          findFirst: jest.fn().mockResolvedValue({
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

  // ==============================================================
  // (B) BỘ LỌC NGUỒN TIN — ALL / STANDARD / HUNT
  // ==============================================================
  describe('listMyJobs — lọc nguồn tin (B)', () => {
    const huntJob = {
      ...baseJobRow,
      id: 'job-hunt',
      code: 'JOB-2026-000002',
      title: 'Kỹ sư điện tử (Tin săn)',
      status: JobStatus.Published,
      slug: 'ky-su-dien-tu',
      jobPackage: null,
      company: { ...baseJobRow.company },
      skills: [],
    };
    const standardPaidJob = {
      ...baseJobRow,
      id: 'job-std',
      code: 'JOB-2026-000003',
      title: 'Kỹ sư cơ khí',
      status: JobStatus.Published,
      slug: 'ky-su-co-khi',
      jobPackage: {
        id: 'pkg-1',
        code: 'JD-DN-000006',
        packageName: 'Gói Doanh nghiệp',
        packageType: 'ENTERPRISE',
      },
      company: { ...baseJobRow.company },
      skills: [],
    };

    function makeSourcePrisma() {
      const findMany = jest.fn().mockResolvedValue([huntJob, standardPaidJob]);
      const campaignFindMany = jest.fn().mockResolvedValue([
        {
          jobId: 'job-hunt',
          code: 'CS-000001',
          package: { code: 'TS-000101', status: 'ACTIVE' },
        },
      ]);
      return {
        job: { findMany },
        huntCampaign: { findMany: campaignFindMany },
        application: { groupBy: jest.fn().mockResolvedValue([]) },
      };
    }

    it('source=ALL trả về cả 2 tin, mỗi tin đúng 1 nguồn', async () => {
      const prisma = makeSourcePrisma();
      const service = buildService(prisma);

      const list = await service.listMyJobs(recruiter, 'ALL');

      expect(list).toHaveLength(2);
      const hunt = list.find((j) => j.id === 'job-hunt');
      const std = list.find((j) => j.id === 'job-std');
      expect(hunt?.source).toBe('HUNT');
      expect(hunt?.huntPackageCode).toBe('TS-000101');
      expect(hunt?.huntCampaignCode).toBe('CS-000001');
      expect(std?.source).toBe('STANDARD');
      expect(std?.jobPackageCode).toBe('JD-DN-000006');
      // Tin săn KHÔNG được gắn badge gói tin đăng song song.
      expect(hunt?.jobPackageCode).toBeUndefined();
    });

    it('source=HUNT chỉ trả tin thuộc chiến dịch Săn ACTIVE', async () => {
      const prisma = makeSourcePrisma();
      const service = buildService(prisma);

      const list = await service.listMyJobs(recruiter, 'HUNT');

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('job-hunt');
      expect(list[0].source).toBe('HUNT');
    });

    it('source=STANDARD trả các tin còn lại (không trùng với HUNT)', async () => {
      const prisma = makeSourcePrisma();
      const service = buildService(prisma);

      const list = await service.listMyJobs(recruiter, 'STANDARD');

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('job-std');
      expect(list[0].source).toBe('STANDARD');
    });
  });

  describe('countMyJobsBySource — số đếm theo nguồn (B)', () => {
    it('standard + hunt === all, và số đếm theo bộ lọc hiện tại', async () => {
      const prisma = {
        job: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'job-hunt',
              title: 'Kỹ sư điện tử',
              code: 'JOB-2026-000002',
              location: 'Hà Nội',
              industry: null,
              skills: [],
            },
            {
              id: 'job-std',
              title: 'Kỹ sư cơ khí',
              code: 'JOB-2026-000003',
              location: 'Hải Phòng',
              industry: null,
              skills: [],
            },
          ]),
        },
      };
      const service = buildService(prisma);
      billing.huntOwnedJobIds.mockResolvedValue(new Set(['job-hunt']));

      const counts = await service.countMyJobsBySource(recruiter, {});

      expect(counts).toEqual({ all: 2, standard: 1, hunt: 1 });
      expect(counts.standard + counts.hunt).toBe(counts.all);
    });

    it('từ khoá lọc trước khi đếm → số đếm khớp danh sách đã lọc', async () => {
      const prisma = {
        job: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'job-hunt',
              title: 'Kỹ sư điện tử',
              code: 'JOB-2026-000002',
              location: 'Hà Nội',
              industry: null,
              skills: [],
            },
            {
              id: 'job-std',
              title: 'Kỹ sư cơ khí',
              code: 'JOB-2026-000003',
              location: 'Hải Phòng',
              industry: null,
              skills: [],
            },
          ]),
        },
      };
      const service = buildService(prisma);
      billing.huntOwnedJobIds.mockResolvedValue(new Set(['job-hunt']));

      const counts = await service.countMyJobsBySource(recruiter, { keyword: 'điện tử' });

      expect(counts).toEqual({ all: 1, standard: 0, hunt: 1 });
      expect(counts.standard + counts.hunt).toBe(counts.all);
    });
  });
});
