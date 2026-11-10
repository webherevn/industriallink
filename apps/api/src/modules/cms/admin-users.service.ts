import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  UserRole,
  UserStatus,
  type AdminCreateUserRequest,
  type AdminSystemResetPreviewView,
  type AdminSystemResetRequest,
  type AdminSystemResetResultView,
  type AdminUpdateUserRequest,
  type AdminUserView,
  type CreateCrmStaffAccountRequest,
  type CrmStaffAccountView,
  type CrmStaffDirectory,
  type UpdateCrmStaffAccountRequest,
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
  UserRole.Sales,
  UserRole.SalesManager,
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
    if (input.department !== undefined) data.department = input.department?.trim().slice(0, 80) || null;
    if (input.password) {
      if (input.password.length < 8) {
        throw new BadRequestException('Mật khẩu phải ≥ 8 ký tự');
      }
      data.passwordHash = await this.password.hash(input.password);
    }

    const row = await this.prisma.user.update({ where: { id }, data });
    if (input.status === UserStatus.Locked || input.status === UserStatus.Deleted) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.map(row);
  }

  async previewSystemReset(actor: AuthenticatedUser): Promise<AdminSystemResetPreviewView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin mới được phép xem và thực hiện Reset dữ liệu Go-Live');
    }
    const [
      superAdminCount,
      editorCount,
      salesStaffCount,
      recruiterUserCount,
      candidateUserCount,
      companyCount,
      jobCount,
      applicationCount,
      candidateProfileCount,
      billingOrderCount,
      crmLeadCount,
      crmDealCount,
      crmPartnerCount,
      analyticsHitCount,
      auditLogCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false, role: UserRole.SuperAdmin } }),
      this.prisma.user.count({ where: { isDeleted: false, role: UserRole.Editor } }),
      this.prisma.user.count({
        where: { isDeleted: false, role: { in: [UserRole.Sales, UserRole.SalesManager] } },
      }),
      this.prisma.user.count({
        where: {
          isDeleted: false,
          role: { in: [UserRole.Recruiter, UserRole.CompanyAdmin, UserRole.HiringManager] },
        },
      }),
      this.prisma.user.count({ where: { isDeleted: false, role: UserRole.Candidate } }),
      this.prisma.company.count(),
      this.prisma.job.count(),
      this.prisma.application.count(),
      this.prisma.candidate.count(),
      this.prisma.billingOrder.count(),
      this.prisma.crmLead.count(),
      this.prisma.crmDeal.count(),
      this.prisma.crmPartner.count(),
      this.prisma.analyticsHit.count(),
      this.prisma.auditLog.count(),
    ]);

    return {
      superAdminCount,
      editorCount,
      salesStaffCount,
      recruiterUserCount,
      candidateUserCount,
      companyCount,
      jobCount,
      applicationCount,
      candidateProfileCount,
      billingOrderCount,
      crmLeadCount,
      crmDealCount,
      crmPartnerCount,
      analyticsHitCount,
      auditLogCount,
    };
  }

  async executeSystemReset(
    actor: AuthenticatedUser,
    input: AdminSystemResetRequest,
  ): Promise<AdminSystemResetResultView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin mới được phép thực hiện Reset dữ liệu Go-Live');
    }
    if ((input.confirmPhrase ?? '').trim().toUpperCase() !== 'RESET INLINK') {
      throw new BadRequestException('Cụm từ xác nhận không đúng. Vui lòng nhập chính xác: RESET INLINK');
    }
    if (!input.password) {
      throw new BadRequestException('Vui lòng nhập mật khẩu SuperAdmin hiện tại để xác nhận');
    }

    const adminUser = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!adminUser || adminUser.isDeleted) {
      throw new NotFoundException('Không tìm thấy tài khoản SuperAdmin');
    }

    const passwordValid = await this.password.verify(adminUser.passwordHash, input.password);
    if (!passwordValid) {
      throw new BadRequestException('Mật khẩu SuperAdmin không chính xác');
    }

    const keepEditors = input.keepEditors !== false;
    const keepSalesStaff = input.keepSalesStaff === true;
    const clearAnalyticsAndAudit = input.clearAnalyticsAndAudit !== false;

    const keptRoles: string[] = [UserRole.SuperAdmin];
    if (keepEditors) keptRoles.push(UserRole.Editor);
    if (keepSalesStaff) keptRoles.push(UserRole.Sales, UserRole.SalesManager);

    const keptUsers = await this.prisma.user.findMany({
      where: {
        isDeleted: false,
        role: { in: keptRoles },
      },
      select: { id: true },
    });

    const keptUserIdSet = new Set<string>(keptUsers.map((u) => u.id));
    keptUserIdSet.add(actor.id);
    const keptUserIds = Array.from(keptUserIdSet);

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Dữ liệu giao dịch CRM
        await tx.crmCommissionWalletTxn.deleteMany({});
        await tx.crmCommissionWallet.deleteMany({});
        await tx.crmCommissionEntry.deleteMany({});
        await tx.crmCommissionPeriod.deleteMany({});
        await tx.crmOrderInvoice.deleteMany({});
        await tx.crmActivity.deleteMany({});
        await tx.crmQuoteInstallment.deleteMany({});
        await tx.crmQuote.deleteMany({});
        await tx.crmDeal.deleteMany({});
        const deletedLeads = await tx.crmLead.deleteMany({});
        await tx.crmPartnerClaim.deleteMany({});
        await tx.crmReferralSignup.deleteMany({});
        await tx.crmPartner.deleteMany({});
        await tx.crmMarketingCost.deleteMany({});
        await tx.crmCampaign.deleteMany({});
        await tx.crmStaffProfile.deleteMany({
          where: { userId: { notIn: keptUserIds } },
        });

        // 2. Dữ liệu giao dịch Billing (Ví, Gói gán công ty, Đơn hàng) — giữ nguyên bảng giá cấu hình
        await tx.billingSourcingUsage.deleteMany({});
        await tx.billingSourcingEngagement.deleteMany({});
        await tx.billingCompanySourcingPlan.deleteMany({});
        await tx.billingCompanyPlan.deleteMany({});
        await tx.billingCreditTransaction.deleteMany({});
        await tx.billingCreditAccount.deleteMany({});
        await tx.billingPayment.deleteMany({});
        const deletedOrders = await tx.billingOrder.deleteMany({});

        // 3. Dữ liệu Tuyển dụng, Ứng viên & Công ty
        await tx.onboarding.deleteMany({});
        await tx.offer.deleteMany({});
        await tx.interview.deleteMany({});
        await tx.applicationTimeline.deleteMany({});
        await tx.application.deleteMany({});
        await tx.jobBookmark.deleteMany({});
        await tx.jobSkill.deleteMany({});
        const deletedJobs = await tx.job.deleteMany({});

        await tx.connectionMessage.deleteMany({});
        await tx.candidateConnection.deleteMany({});
        await tx.candidateShortlist.deleteMany({});
        await tx.candidateTimeline.deleteMany({});
        await tx.candidateSearchIndex.deleteMany({});
        await tx.candidateAiProfile.deleteMany({});
        await tx.candidateSkill.deleteMany({});
        await tx.candidateResume.deleteMany({});
        await tx.candidateExperience.deleteMany({});
        await tx.candidateProfile.deleteMany({});
        const deletedCandidates = await tx.candidate.deleteMany({});

        await tx.companyMember.deleteMany({});
        const deletedCompanies = await tx.company.deleteMany({});

        // 4. Bảo toàn bài viết CMS & xoá các tài khoản người dùng không thuộc diện giữ lại
        await tx.cmsPost.updateMany({
          where: { authorId: { notIn: keptUserIds } },
          data: { authorId: actor.id },
        });
        await tx.cmsAuthorProfile.deleteMany({
          where: { userId: { notIn: keptUserIds } },
        });

        await tx.notification.deleteMany({});
        await tx.supportChatMessage.deleteMany({});
        await tx.supportChat.deleteMany({});
        await tx.otpCode.deleteMany({
          where: { userId: { notIn: keptUserIds } },
        });
        await tx.refreshToken.deleteMany({
          where: { userId: { notIn: keptUserIds } },
        });

        const deletedUsers = await tx.user.deleteMany({
          where: { id: { notIn: keptUserIds } },
        });

        // 5. Reset bộ đếm mã nghiệp vụ (trừ USR để không trùng mã với tài khoản được giữ lại)
        await tx.sequence.deleteMany({
          where: { NOT: { key: { startsWith: 'USR-' } } },
        });

        // 6. Xoá Analytics & AuditLog lúc test nếu được chọn
        if (clearAnalyticsAndAudit) {
          await tx.analyticsHit.deleteMany({});
          await tx.webVitalSample.deleteMany({});
          await tx.auditLog.deleteMany({});
        }

        const resetAt = new Date().toISOString();
        await tx.auditLog.create({
          data: {
            tenantId: DEFAULT_TENANT_ID,
            actorId: actor.id,
            action: 'system.go_live_reset',
            entityType: 'system',
            entityId: actor.id,
            after: {
              resetAt,
              keepEditors,
              keepSalesStaff,
              clearAnalyticsAndAudit,
              keptUsersCount: keptUserIds.length,
              deletedUsersCount: deletedUsers.count,
              deletedCompaniesCount: deletedCompanies.count,
              deletedJobsCount: deletedJobs.count,
              deletedCandidatesCount: deletedCandidates.count,
              deletedOrdersCount: deletedOrders.count,
              deletedCrmLeadsCount: deletedLeads.count,
            },
          },
        });

        return {
          ok: true as const,
          resetAt,
          keptUsersCount: keptUserIds.length,
          deletedUsersCount: deletedUsers.count,
          deletedCompaniesCount: deletedCompanies.count,
          deletedJobsCount: deletedJobs.count,
          deletedCandidatesCount: deletedCandidates.count,
          deletedOrdersCount: deletedOrders.count,
          deletedCrmLeadsCount: deletedLeads.count,
        };
      },
      { timeout: 60_000 },
    );
  }

  /** Bảng nhân sự trên CRM. Cùng bản ghi user với trang Người dùng. */
  async staffDirectory(actor: AuthenticatedUser): Promise<CrmStaffDirectory> {
    this.assertStaffReader(actor);
    const rows = await this.prisma.user.findMany({
      where: { isDeleted: false, role: { in: [UserRole.Sales, UserRole.SalesManager] } },
      orderBy: [{ displayName: 'asc' }],
    });
    return {
      rows: rows.map((row) => this.mapStaff(row)),
      canEdit: actor.role === UserRole.SuperAdmin,
      canAdd: true,
    };
  }

  async createStaff(actor: AuthenticatedUser, input: CreateCrmStaffAccountRequest): Promise<CrmStaffAccountView> {
    this.assertStaffReader(actor);
    if (!input.displayName || input.displayName.trim().length < 2) {
      throw new BadRequestException('Cần tên đầy đủ');
    }
    const role = this.staffRoleForCreate(actor, input.role);
    const created = await this.createUser(actor, {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      role,
    });
    if (input.department !== undefined) {
      const updated = await this.updateUser(actor, created.id, { department: input.department });
      return this.asStaff(updated);
    }
    return this.asStaff(created);
  }

  async updateStaff(actor: AuthenticatedUser, id: string, input: UpdateCrmStaffAccountRequest): Promise<CrmStaffAccountView> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin sửa tài khoản nhân sự');
    }
    await this.requireStaff(id);
    if (input.role && input.role !== UserRole.Sales && input.role !== UserRole.SalesManager) {
      throw new BadRequestException('Vai trò nhân sự là nhân viên hoặc trưởng phòng');
    }
    if (input.status && input.status !== UserStatus.Active && input.status !== UserStatus.Locked) {
      throw new BadRequestException('Trạng thái là đang dùng hoặc khóa');
    }
    const updated = await this.updateUser(actor, id, {
      displayName: input.displayName,
      role: input.role === undefined ? undefined : this.staffRoleForCreate(actor, input.role),
      status: input.status as UserStatus | undefined,
      password: input.password,
      department: input.department,
    });
    return this.asStaff(updated);
  }

  /** Xóa mềm. Trang Người dùng ở Admin không còn hiện tài khoản này. */
  async deleteStaff(actor: AuthenticatedUser, id: string): Promise<{ ok: true }> {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Chỉ SuperAdmin xóa tài khoản nhân sự');
    }
    await this.requireStaff(id);
    await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: actor.id,
        status: UserStatus.Deleted,
        updatedBy: actor.id,
        version: { increment: 1 },
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private assertStaffReader(actor: AuthenticatedUser): void {
    if (actor.role === UserRole.SuperAdmin || actor.role === UserRole.SalesManager) return;
    throw new ForbiddenException('Bảng nhân sự dành cho trưởng phòng và SuperAdmin');
  }

  private staffRoleForCreate(actor: AuthenticatedUser, role: CreateCrmStaffAccountRequest['role']): UserRole.Sales | UserRole.SalesManager {
    if (actor.role === UserRole.SalesManager) {
      if (role && role !== UserRole.Sales) {
        throw new ForbiddenException('Trưởng phòng chỉ thêm nhân viên kinh doanh');
      }
      return UserRole.Sales;
    }
    if (role === UserRole.SalesManager) return UserRole.SalesManager;
    if (role === UserRole.Sales) return UserRole.Sales;
    throw new BadRequestException('Chọn nhân viên hoặc trưởng phòng kinh doanh');
  }

  private async requireStaff(id: string): Promise<User> {
    const row = await this.prisma.user.findFirst({
      where: { id, isDeleted: false, role: { in: [UserRole.Sales, UserRole.SalesManager] } },
    });
    if (!row) throw new NotFoundException('Không thấy nhân sự');
    return row;
  }

  private asStaff(row: AdminUserView): CrmStaffAccountView {
    if (row.role !== UserRole.Sales && row.role !== UserRole.SalesManager) {
      throw new BadRequestException('Tài khoản này không còn là nhân sự');
    }
    return {
      id: row.id,
      code: row.code,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      department: row.department,
      status: String(row.status),
    };
  }

  private mapStaff(row: User): CrmStaffAccountView {
    return this.asStaff(this.map(row));
  }

  private map(u: User): AdminUserView {
    return {
      id: u.id,
      code: u.code,
      email: u.email,
      displayName: u.displayName,
      role: u.role as UserRole,
      department: u.department,
      status: u.status,
      isVerified: u.isVerified,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
