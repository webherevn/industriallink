import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CompanyRole } from '@industriallink/contracts';
import { CompanyService } from './company.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

describe('CompanyService', () => {
  const events = { publish: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const codeGen = { next: jest.fn().mockResolvedValue('COM-2026-000001') };

  function buildService(prisma: Record<string, unknown>) {
    events.publish.mockClear();
    audit.record.mockClear();
    codeGen.next.mockClear();
    return new CompanyService(prisma as never, codeGen as never, events as never, audit as never);
  }

  const owner: AuthenticatedUser = {
    id: 'user-1',
    email: 'owner@abc.com',
    role: 'recruiter' as never,
    tenantId: 'default',
    displayName: 'Owner A',
    status: 'active',
  };

  describe('createCompany', () => {
    it('tạo công ty mới và gán user làm Owner', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'co-1',
        code: 'COM-2026-000001',
        name: 'Công ty ABC',
        taxCode: null,
        industry: null,
        size: null,
        address: null,
        website: null,
        description: null,
        status: 'active',
      });
      const prisma = {
        companyMember: { findFirst: jest.fn().mockResolvedValue(null) },
        company: { create },
      };
      const service = buildService(prisma);

      const result = await service.createCompany(
        owner,
        { name: 'Công ty ABC' },
        'corr-1',
      );

      expect(result.myRole).toBe(CompanyRole.Owner);
      expect(result.memberCount).toBe(1);
      expect(create.mock.calls[0][0].data.members.create.roleInCompany).toBe(CompanyRole.Owner);
      expect(events.publish).toHaveBeenCalledTimes(1);
    });

    it('từ chối nếu user đã thuộc công ty khác', async () => {
      const prisma = {
        companyMember: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
        company: { create: jest.fn() },
      };
      const service = buildService(prisma);

      await expect(
        service.createCompany(owner, { name: 'Công ty XYZ' }, 'corr-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateMyCompany', () => {
    it('cho phép Owner/Admin sửa hồ sơ công ty', async () => {
      const update = jest.fn().mockResolvedValue({
        id: 'co-1',
        name: 'Tên mới',
        taxCode: null,
        industry: null,
        size: null,
        address: null,
        website: null,
        description: null,
        status: 'active',
      });
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ companyId: 'co-1', roleInCompany: CompanyRole.Admin }),
          count: jest.fn().mockResolvedValue(3),
        },
        company: {
          findUnique: jest.fn().mockResolvedValue({ name: 'Tên cũ' }),
          update,
        },
      };
      const service = buildService(prisma);

      const result = await service.updateMyCompany(owner, { name: 'Tên mới' }, 'corr-3');

      expect(result.name).toBe('Tên mới');
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('từ chối Member sửa hồ sơ công ty', async () => {
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ companyId: 'co-1', roleInCompany: CompanyRole.Member }),
        },
        company: { update: jest.fn() },
      };
      const service = buildService(prisma);

      await expect(
        service.updateMyCompany(owner, { name: 'Tên mới' }, 'corr-4'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('inviteMember', () => {
    it('mời thành công user chưa thuộc công ty nào', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'mem-2',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      });
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ companyId: 'co-1', roleInCompany: CompanyRole.Owner })
            .mockResolvedValueOnce(null),
          create,
        },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'u2', email: 'new@abc.com', displayName: 'Nguyễn B', isDeleted: false }),
        },
      };
      const service = buildService(prisma);

      const result = await service.inviteMember(
        owner,
        { email: 'new@abc.com', roleInCompany: CompanyRole.Member },
        'corr-5',
      );

      expect(result.email).toBe('new@abc.com');
      expect(result.roleInCompany).toBe(CompanyRole.Member);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'co-1', userId: 'u2' }),
        }),
      );
    });

    it('từ chối nếu người được mời đã thuộc công ty khác', async () => {
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ companyId: 'co-1', roleInCompany: CompanyRole.Owner })
            .mockResolvedValueOnce({ id: 'already-member' }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'u3', email: 'x@abc.com', isDeleted: false }),
        },
      };
      const service = buildService(prisma);

      await expect(
        service.inviteMember(owner, { email: 'x@abc.com', roleInCompany: CompanyRole.Member }, 'corr-6'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('từ chối Member mời thành viên mới (không phải Owner/Admin)', async () => {
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ companyId: 'co-1', roleInCompany: CompanyRole.Member }),
        },
        user: { findUnique: jest.fn() },
      };
      const service = buildService(prisma);

      await expect(
        service.inviteMember(owner, { email: 'x@abc.com', roleInCompany: CompanyRole.Member }, 'corr-7'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('không cho gỡ chủ sở hữu công ty', async () => {
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ companyId: 'co-1', roleInCompany: CompanyRole.Admin })
            .mockResolvedValueOnce({
              id: 'mem-owner',
              userId: 'owner-user',
              companyId: 'co-1',
              roleInCompany: CompanyRole.Owner,
            }),
          delete: jest.fn(),
        },
      };
      const service = buildService(prisma);

      await expect(service.removeMember(owner, 'mem-owner', 'corr-8')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.companyMember.delete).not.toHaveBeenCalled();
    });

    it('không cho tự gỡ chính mình', async () => {
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ companyId: 'co-1', roleInCompany: CompanyRole.Owner })
            .mockResolvedValueOnce({
              id: 'mem-self',
              userId: owner.id,
              companyId: 'co-1',
              roleInCompany: CompanyRole.Admin,
            }),
          delete: jest.fn(),
        },
      };
      const service = buildService(prisma);

      await expect(service.removeMember(owner, 'mem-self', 'corr-9')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('gỡ thành công thành viên thường', async () => {
      const del = jest.fn().mockResolvedValue({});
      const prisma = {
        companyMember: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ companyId: 'co-1', roleInCompany: CompanyRole.Owner })
            .mockResolvedValueOnce({
              id: 'mem-3',
              userId: 'other-user',
              companyId: 'co-1',
              roleInCompany: CompanyRole.Member,
            }),
          delete: del,
        },
      };
      const service = buildService(prisma);

      const result = await service.removeMember(owner, 'mem-3', 'corr-10');

      expect(result.message).toContain('Đã gỡ');
      expect(del).toHaveBeenCalledWith({ where: { id: 'mem-3' } });
    });
  });

  describe('requireUserCompany', () => {
    it('ném ForbiddenException nếu user chưa có công ty', async () => {
      const prisma = { companyMember: { findFirst: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.requireUserCompany('user-x')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getMyCompany', () => {
    it('ném NotFoundException nếu chưa có công ty', async () => {
      const prisma = { companyMember: { findFirst: jest.fn().mockResolvedValue(null) } };
      const service = buildService(prisma);

      await expect(service.getMyCompany(owner)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
