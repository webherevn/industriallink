import { CandidateService } from './candidate.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

/**
 * ⭐ Kiểm chứng quyền xem thông tin liên hệ (`canViewFullContact`).
 *
 * Quy tắc:
 * - Công ty đã mở khóa hồ sơ bằng Credit (trạng thái "Đã xem")
 *   → trả đầy đủ email + số điện thoại, KHÔNG mask.
 * - Ứng viên đã tự ứng tuyển vào tin của công ty
 *   → trả đầy đủ email + số điện thoại, KHÔNG mask.
 * - Ứng viên "Chưa xem" (chưa mở khóa, chưa tự ứng tuyển)
 *   → trả dữ liệu ĐÃ MASK (email/số điện thoại = null, kèm bản masked).
 */
describe('CandidateService.getCandidateForRecruiter — quyền xem liên hệ', () => {
  const recruiter: AuthenticatedUser = {
    id: 'user-r-1',
    email: 'r@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'NTD A',
    status: 'active',
  };

  const candidateRow = {
    id: 'can-1',
    tenantId: 'default',
    displayName: 'Ứng Viên B',
    isDeleted: false,
    profile: {
      phone: '0987654538',
      jobTrack: 'technical',
      currentPosition: 'Kỹ sư PLC',
    },
    aiProfile: null,
    skills: [],
    experiences: [],
    user: { email: 'ungvienb@gmail.com' },
  };

  function buildService(opts: {
    unlockedByCredit: boolean;
    appliedToCompany: boolean;
    connectionStatus?: string;
  }) {
    const prisma = {
      candidate: {
        findFirst: jest.fn().mockResolvedValue(candidateRow),
      },
      candidateConnection: {
        findUnique: jest.fn().mockResolvedValue(
          opts.connectionStatus
            ? {
                id: 'conn-1',
                status: opts.connectionStatus,
                companyId: 'company-1',
                candidateId: 'can-1',
                createdAt: new Date('2026-07-01T00:00:00.000Z'),
                respondedAt: null,
                message: null,
                company: { id: 'company-1', name: 'Công ty ABC' },
                candidate: { id: 'can-1', displayName: 'Ứng Viên B' },
              }
            : null,
        ),
      },
      candidateShortlist: { findUnique: jest.fn().mockResolvedValue(null) },
      application: {
        findFirst: jest.fn().mockResolvedValue(
          opts.appliedToCompany ? { id: 'app-1' } : null,
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      job: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      billingCreditTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const credit = {
      isProfileUnlockedByCompany: jest
        .fn()
        .mockResolvedValue(opts.unlockedByCredit),
      consumeAction: jest.fn().mockResolvedValue(null),
      resolveActionCost: jest.fn().mockResolvedValue({ cost: 1 }),
    };

    const billing = {
      ensureCompanyPlan: jest.fn().mockResolvedValue({ planCode: 'PRO' }),
      hasActiveSourcingPlan: jest.fn().mockResolvedValue(false),
    };

    const service = new CandidateService(
      prisma as never,
      { } as never, // storage
      { next: jest.fn() } as never, // codeGen
      { publish: jest.fn() } as never, // events
      { } as never, // ai
      { requireUserCompany: jest.fn().mockResolvedValue({ companyId: 'company-1' }) } as never,
      { } as never, // notifications
      credit as never,
      billing as never,
      {
        coverIncludedOpen: jest.fn().mockResolvedValue('skip'),
        recordProfileOpen: jest.fn().mockResolvedValue(undefined),
      } as never,
      { add: jest.fn() } as never, // queue
    );

    return { service, credit };
  }

  it('⭐ hồ sơ đã mở khóa bằng Credit ("Đã xem") → trả ĐẦY ĐỦ email + SĐT', async () => {
    const { service } = buildService({ unlockedByCredit: true, appliedToCompany: false });

    const result = await service.getCandidateForRecruiter(recruiter, 'can-1');

    expect(result.contactUnlocked).toBe(true);
    expect(result.email).toBe('ungvienb@gmail.com');
    expect(result.phone).toBe('0987654538');
    // Vẫn có bản masked để dự phòng.
    expect(result.emailMasked).toBe('un***@gmail.com');
    expect(result.phoneMasked).toBe('098***538');
  });

  it('⭐ ứng viên đã TỰ ỨNG TUYỂN → trả đầy đủ email + SĐT (không cần mở khóa)', async () => {
    const { service } = buildService({ unlockedByCredit: false, appliedToCompany: true });

    const result = await service.getCandidateForRecruiter(recruiter, 'can-1');

    expect(result.contactUnlocked).toBe(true);
    expect(result.email).toBe('ungvienb@gmail.com');
    expect(result.phone).toBe('0987654538');
    expect(result.appliedToCompany).toBe(true);
  });

  it('⭐ ứng viên "Chưa xem" → trả dữ liệu ĐÃ MASK', async () => {
    const { service } = buildService({ unlockedByCredit: false, appliedToCompany: false });

    const result = await service.getCandidateForRecruiter(recruiter, 'can-1');

    expect(result.contactUnlocked).toBe(false);
    // Không lộ dữ liệu thật.
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    // Nhưng vẫn có bản masked để hiển thị "che mờ" phía trước.
    expect(result.emailMasked).toBe('un***@gmail.com');
    expect(result.phoneMasked).toBe('098***538');
  });

  it('ứng viên đã chấp nhận kết nối → trả đầy đủ email + SĐT', async () => {
    const { service } = buildService({
      unlockedByCredit: false,
      appliedToCompany: false,
      connectionStatus: 'accepted',
    });

    const result = await service.getCandidateForRecruiter(recruiter, 'can-1');

    expect(result.contactUnlocked).toBe(true);
    expect(result.email).toBe('ungvienb@gmail.com');
  });
});
