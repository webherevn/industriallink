import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import type {
  RecruiterCreditBalanceResponse,
  RecruiterCreditSummaryResponse,
  BillingCreditLedgerListResponse,
} from '@industriallink/contracts';
import { CreditService } from './credit.service';
import { CompanyService } from '../company/company.service';

@ApiTags('Recruiter Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Recruiter, UserRole.SuperAdmin)
@Controller('billing')
export class BillingRecruiterController {
  constructor(
    private readonly credit: CreditService,
    private readonly companies: CompanyService,
  ) {}

  @Get('credits/balance')
  @ApiOperation({ summary: 'Số dư Credit của công ty user' })
  async getBalance(@CurrentUser() user: AuthenticatedUser): Promise<RecruiterCreditBalanceResponse> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const account = await this.credit.getAccountView(companyId);
    return {
      balance: account?.balance ?? 0,
      lifetimeGranted: account?.lifetimeGranted ?? 0,
      lifetimeConsumed: account?.lifetimeConsumed ?? 0,
      lifetimeRefunded: account?.lifetimeRefunded ?? 0,
    };
  }

  @Get('credits/transactions')
  @ApiOperation({ summary: 'Lịch sử giao dịch Credit của công ty user' })
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<BillingCreditLedgerListResponse> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    return this.credit.listForCompany(companyId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('credits/summary')
  @ApiOperation({ summary: '30 ngày gần nhất: tổng tiêu thụ + breakdown theo action' })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecruiterCreditSummaryResponse> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Lấy 1 lần đủ dùng (giới hạn 500 giao dịch gần nhất trong 30 ngày)
    const { items: txs } = await this.credit.listForCompany(companyId, { limit: 500 });
    const tx30d = txs.filter((t) => new Date(t.createdAt) >= thirtyDaysAgo);

    // Consumption = tổng |creditDelta| của các giao dịch TRỪ (delta âm)
    const byAction: Record<string, number> = {};
    const last7: Record<string, number> = {};
    let totalConsumed30d = 0;

    for (const t of tx30d) {
      if (t.creditDelta < 0) {
        const consumed = Math.abs(t.creditDelta);
        totalConsumed30d += consumed;
        byAction[t.action] = (byAction[t.action] ?? 0) + consumed;

        const d = new Date(t.createdAt);
        if (d >= sevenDaysAgo) {
          const key = d.toISOString().split('T')[0];
          last7[key] = (last7[key] ?? 0) + consumed;
        }
      }
    }

    const dailySeries = Object.entries(last7)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalConsumed30d,
      byAction: Object.entries(byAction).map(([action, total]) => ({ action, total })),
      dailySeries,
    };
  }
}
