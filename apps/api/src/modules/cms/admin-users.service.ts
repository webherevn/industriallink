import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  UserRole,
  UserStatus,
  type AdminCreateUserRequest,
  type AdminUpdateUserRequest,
  type AdminUserView,
} from '@industriallink/contracts';
import type { User } from '@prisma/client';
import { DEFAULT_TENANT_ID } from '../../shared/common/constants';
import { CodeGeneratorService } from '../../shared/infrastructure/code-generator.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { PasswordService } from '../../shared/security/password.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

const ASSIGNABLE_ROLES = new Set<UserRole>([
  UserRole.SuperAdmin,
  UserRole.Editor,
  UserRole.Recruiter,
  UserRole.HiringManager,
  UserRole.CompanyAdmin,
  UserRole.Candidate,
]);

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly codes: CodeGeneratorService,
  ) {}

  async listUsers(): Promise<AdminUserView[]> {
    const rows = await this.prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((u) => this.map(u));
  }

  async createUser(
    actor: AuthenticatedUser,
    input: AdminCreateUserRequest,
  ): Promise<AdminUserView> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || input.password.length < 8) {
      throw new BadRequestException('Email và mật khẩu (≥ 8 ký tự) bắt buộc');
    }
    if (!ASSIGNABLE_ROLES.has(input.role)) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists && !exists.isDeleted) {
      throw new ConflictException('Email đã tồn tại');
    }

    const passwordHash = await this.password.hash(input.password);
    const code = await this.codes.next('USR');

    if (exists?.isDeleted) {
      const row = await this.prisma.user.update({
        where: { id: exists.id },
        data: {
          code,
          passwordHash,
          displayName: input.displayName.trim(),
          role: input.role,
          status: UserStatus.Active,
          isVerified: true,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          updatedBy: actor.id,
          version: { increment: 1 },
        },
      });
      return this.map(row);
    }

    const row = await this.prisma.user.create({
      data: {
        code,
        tenantId: DEFAULT_TENANT_ID,
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        role: input.role,
        status: UserStatus.Active,
        isVerified: true,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
    return this.map(row);
  }

  async updateUser(
    actor: AuthenticatedUser,
    id: string,
    input: AdminUpdateUserRequest,
  ): Promise<AdminUserView> {
    const existing = await this.prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy người dùng');

    if (input.role && !ASSIGNABLE_ROLES.has(input.role)) {
      throw new BadRequestException('Vai trò không hợp lệ');
    }

    if (
      existing.role === UserRole.SuperAdmin &&
      ((input.role && input.role !== UserRole.SuperAdmin) ||
        input.status === UserStatus.Locked ||
        input.status === UserStatus.Deleted)
    ) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          isDeleted: false,
          role: UserRole.SuperAdmin,
          status: UserStatus.Active,
          id: { not: id },
        },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('Không thể hạ/khóa Superadmin cuối cùng');
      }
    }

    if (id === actor.id && input.role && input.role !== UserRole.SuperAdmin) {
      throw new BadRequestException('Không thể tự hạ quyền Superadmin của chính mình');
    }

    const data: Record<string, unknown> = {
      updatedBy: actor.id,
      version: { increment: 1 },
    };
    if (input.displayName !== undefined) data.displayName = input.displayName.trim();
    if (input.role !== undefined) data.role = input.role;
    if (input.status !== undefined) data.status = input.status;
    if (input.password) {
      if (input.password.length < 8) {
        throw new BadRequestException('Mật khẩu phải ≥ 8 ký tự');
      }
      data.passwordHash = await this.password.hash(input.password);
    }

    const row = await this.prisma.user.update({ where: { id }, data });
    return this.map(row);
  }

  private map(u: User): AdminUserView {
    return {
      id: u.id,
      code: u.code,
      email: u.email,
      displayName: u.displayName,
      role: u.role as UserRole,
      status: u.status,
      isVerified: u.isVerified,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
