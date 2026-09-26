import { Injectable } from '@nestjs/common';
import {
  CompanyStatus,
  JobModerationStatus,
  JobStatus,
  UserStatus,
  type AdminReportsView,
} from '@industriallink/contracts';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const DAY_SPAN = 14;

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdminReportsView> {
    const [modGroups, statusGroups, companyGroups, userTotal, lockedUsers, liveJobs, byDayRaw] =
      await Promise.all([
        this.prisma.job.groupBy({
          by: ['moderationStatus'],
          where: { isDeleted: false },
          _count: { _all: true },
        }),
        this.prisma.job.groupBy({
          by: ['status'],
          where: { isDeleted: false },
          _count: { _all: true },
        }),
        this.prisma.company.groupBy({
          by: ['status'],
          where: { isDeleted: false },
          _count: { _all: true },
        }),
        this.prisma.user.count({ where: { isDeleted: false } }),
        this.prisma.user.count({ where: { isDeleted: false, status: UserStatus.Locked } }),
        this.prisma.job.count({
          where: { isDeleted: false, status: JobStatus.Published },
        }),
        this.prisma.$queryRaw<Array<{ day: Date; count: number }>>`
          SELECT ((published_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
                 COUNT(*)::int AS count
          FROM recruitment.job
          WHERE is_deleted = false
            AND published_at IS NOT NULL
            AND published_at >= NOW() - INTERVAL '20 days'
          GROUP BY 1
          ORDER BY 1
        `,
      ]);

    const mod = (s: JobModerationStatus) =>
      modGroups.find((g) => g.moderationStatus === s)?._count._all ?? 0;
    const jobStatus = (s: JobStatus) =>
      statusGroups.find((g) => g.status === s)?._count._all ?? 0;
    const company = (s: CompanyStatus) =>
      companyGroups.find((g) => g.status === s)?._count._all ?? 0;

    const pending = mod(JobModerationStatus.Pending);
    const needsManualReview = mod(JobModerationStatus.NeedsManualReview);
    const approvedAuto = mod(JobModerationStatus.ApprovedAuto);
    const approvedManual = mod(JobModerationStatus.ApprovedManual);
    const rejectedAuto = mod(JobModerationStatus.RejectedAuto);
    const rejectedManual = mod(JobModerationStatus.RejectedManual);
    const approved = approvedAuto + approvedManual;
    const rejected = rejectedAuto + rejectedManual;
    const decided = approved + rejected;

    const byDay = fillDays(byDayRaw, DAY_SPAN);
    const today = byDay[byDay.length - 1]?.date;
    const publishedToday = byDay.find((d) => d.date === today)?.count ?? 0;
    const publishedLast7Days = byDay.slice(-7).reduce((n, d) => n + d.count, 0);

    return {
      generatedAt: new Date().toISOString(),
      queue: { pending, needsManualReview, depth: pending + needsManualReview },
      moderation: {
        approvedAuto,
        approvedManual,
        rejectedAuto,
        rejectedManual,
        approved,
        rejected,
        decided,
        approvalRate: decided ? Math.round((approved / decided) * 100) : null,
        rejectionRate: decided ? Math.round((rejected / decided) * 100) : null,
      },
      companies: {
        total: companyGroups.reduce((n, g) => n + g._count._all, 0),
        active: company(CompanyStatus.Active),
        suspended: company(CompanyStatus.Suspended),
        banned: company(CompanyStatus.Banned),
      },
      users: { total: userTotal, locked: lockedUsers },
      jobs: {
        publishedLive: liveJobs || jobStatus(JobStatus.Published),
        publishedToday,
        publishedLast7Days,
        byDay,
      },
    };
  }
}

function vnDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ }).format(date);
}

function fillDays(
  rows: Array<{ day: Date; count: number }>,
  span: number,
): Array<{ date: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.day instanceof Date ? vnDateKey(row.day) : String(row.day).slice(0, 10);
    counts.set(key, Number(row.count) || 0);
  }
  const today = vnDateKey(new Date());
  const [y, m, d] = today.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  const out: Array<{ date: string; count: number }> = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const dt = new Date(cursor);
    dt.setUTCDate(cursor.getUTCDate() - i);
    const key = dt.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return out;
}
