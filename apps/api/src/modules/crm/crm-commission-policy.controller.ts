import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CreateCtvCommissionPolicyRequest,
  type CrmCommissionPolicySettingsView,
  type CtvCommissionItemView,
  type CtvCommissionPolicyPublicView,
  type CtvMonthlyStatementView,
  type CtvMonthlyTierView,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CtvCommissionPolicyService } from './ctv-commission-policy.service';
import { vietnamPeriodMonth } from './commission-period';

/**
 * API chính sách & tính toán hoa hồng CTV (mô hình 3 cấp bậc).
 *
 * Quyền:
 *  - Xem chính sách / lịch sử: mọi role vào được CRM.
 *  - Tạo phiên bản mới + chốt kỳ: chỉ SuperAdmin.
 */
@ApiTags('CRM - Chính sách hoa hồng CTV')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager)
@Controller('crm/commission-policy')
export class CrmCommissionPolicyController {
  constructor(
    private readonly policy: CtvCommissionPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Chính sách đang áp dụng + lịch sử phiên bản. Sale xem read-only.',
  })
  settings(@CurrentUser() user: AuthenticatedUser): Promise<CrmCommissionPolicySettingsView> {
    return this.policy.settingsView(user);
  }

  @Post()
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({
    summary:
      'Tạo phiên bản chính sách mới (lên lịch). Không áp dụng hồi tố cho kỳ đã phát sinh.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCtvCommissionPolicyRequest,
  ): Promise<CrmCommissionPolicySettingsView> {
    await this.policy.createPolicy(user, body);
    return this.policy.settingsView(user);
  }

  @Get('statements')
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Kỳ đối soát tháng theo CTV. Không chi tiền.' })
  async statements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ctvId') ctvId?: string,
  ): Promise<CtvMonthlyStatementView[]> {
    const target = ctvId ?? (await this.defaultCtvId(user));
    if (!target) return [];
    return this.policy.statementsForCtv(target);
  }

  @Get('statements/:id/items')
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Chi tiết giao dịch hợp lệ trong kỳ đối soát.' })
  items(@Param('id') id: string): Promise<CtvCommissionItemView[]> {
    return this.policy.itemsForStatement(id);
  }

  @Post('statements/:ctvId/:yearMonth/reconcile')
  @Roles(UserRole.SuperAdmin)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Chốt kỳ đối soát tháng (OPEN → RECONCILED). Ghi hoa hồng vào ví chờ chi ngày 10.',
  })
  reconcile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ctvId') ctvId: string,
    @Param('yearMonth') yearMonth: string,
  ): Promise<CtvMonthlyStatementView> {
    void user;
    return this.policy.reconcileStatement(ctvId, yearMonth);
  }

  @Get('tier/:ctvId')
  @Roles(UserRole.SuperAdmin, UserRole.SalesManager)
  @ApiOperation({ summary: 'Bậc tháng hiện tại + thanh tiến độ lên hạng của CTV.' })
  tier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ctvId') ctvId: string,
    @Query('yearMonth') yearMonth?: string,
  ): Promise<CtvMonthlyTierView> {
    void user;
    const month = yearMonth ?? vietnamPeriodMonth(new Date());
    return this.policy.monthlyTier(ctvId, month);
  }

  @Get('public')
  @Roles(
    UserRole.SuperAdmin,
    UserRole.Sales,
    UserRole.SalesManager,
    UserRole.Recruiter,
    UserRole.CompanyAdmin,
    UserRole.HiringManager,
  )
  @ApiOperation({ summary: 'Chính sách public cho Cổng CTV (read-only).' })
  publicPolicy(): Promise<CtvCommissionPolicyPublicView | null> {
    return this.policy.publicPolicy();
  }

  /**
   * CTV mặc định khi không truyền ctvId.
   * SuperAdmin thấy CTV đầu tiên; role khác chỉ thấy CTV của chính mình.
   */
  private async defaultCtvId(user: AuthenticatedUser): Promise<string | null> {
    if (user.role === UserRole.SuperAdmin) {
      const row = await this.prisma.crmPartner.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      return row?.id ?? null;
    }
    const row = await this.prisma.crmPartner.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
