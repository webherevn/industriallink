import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  JobStatus,
  looksLikeUuid,
  shouldUseSalesMatchEngine,
  shouldUseTechnicalMatchEngine,
  type CandidateMatchView,
  type JobMatchView,
  type MatchExplanation,
  type OpenJobMatchBoard,
  type RecruiterSourcingScanCandidateItem,
} from '@industriallink/contracts';
import { CreditService } from '../billing/credit.service';
import { SourcingService } from '../billing/sourcing.service';
import { CompanyService } from '../company/company.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import {
  backfillMissingCompanySlugs,
  backfillMissingJobSlugs,
} from '../../shared/seo/unique-slug';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { buildJobText } from './job.service';
import { candidateMatchTrack, jobMatchTrack, type MatchTrack } from './match-track.util';
import {
  buildB2bExplanation,
  candidateLocationLabel,
  cosine,
  jobToB2bMatchInput,
  toB2bCandidateFromRecords,
} from './matching.util';
import { explainSalesJobCandidate } from './sales-match-explain';
import { explainTechnicalJobCandidate } from './technical-match-explain';
import { plainLabel } from './html.util';

const MATCH_LIMIT = 80;
/** Pool ứng viên đưa vào engine Sales/Kỹ thuật khi matching theo JD. */
const CANDIDATE_POOL = 160;
/** Điểm tối thiểu (0–100) để hiện trong kết quả mạng lưới. */
const MIN_ENGINE_SCORE = 0;

const CANDIDATE_MATCH_INCLUDE = {
  profile: true,
  skills: true,
  experiences: true,
} as const;

/** Chỉ chấm cùng nhóm (KD↔KD, KT↔KT). Thiếu nhóm → không đưa vào gợi ý mạng lưới. */
function sameMatchTrack(jobTrack: MatchTrack | null, candTrack: MatchTrack | null): boolean {
  return Boolean(jobTrack && candTrack && jobTrack === candTrack);
}

type CandidateWithSales = {
  displayName: string;
  profile: Parameters<typeof toB2bCandidateFromRecords>[0]['profile'];
  skills: { name: string }[];
  experiences?: Parameters<typeof toB2bCandidateFromRecords>[0]['experiences'];
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
    private readonly credit: CreditService,
    private readonly sourcing: SourcingService,
    private readonly companies: CompanyService,
    private readonly notifications: NotificationService,
  ) {}

  /** Văn bản đại diện hồ sơ ứng viên để so khớp ngữ nghĩa (tách theo nhánh Sales / Kỹ thuật). */
  private buildCandidateText(candidate: CandidateWithSales): string {
    const b2b = toB2bCandidateFromRecords({
      profile: candidate.profile,
      experiences: candidate.experiences,
      skills: candidate.skills.map((s) => s.name),
    });
    const isTechnical = candidateMatchTrack(candidate) === 'technical';
    return [
      candidate.displayName,
      ...(b2b.jobTitles ?? []),
      ...(b2b.industriesExperienced ?? []),
      ...(isTechnical
        ? [
            (b2b.productsSold ?? []).length ? `Thiết bị: ${(b2b.productsSold ?? []).join(', ')}` : '',
            (b2b.customerSegments ?? []).length
              ? `Môi trường: ${(b2b.customerSegments ?? []).join(', ')}`
              : '',
            (b2b.technicalWorkTypes ?? []).length
              ? `Công việc KT: ${(b2b.technicalWorkTypes ?? []).join(', ')}`
              : '',
            b2b.technicalAutonomyLevel != null ? `Tự chủ mức ${b2b.technicalAutonomyLevel}` : '',
          ]
        : [
            (b2b.productsSold ?? []).length ? `Sản phẩm: ${(b2b.productsSold ?? []).join(', ')}` : '',
            (b2b.customerSegments ?? []).length
              ? `Tệp KH: ${(b2b.customerSegments ?? []).join(', ')}`
              : '',
            (b2b.marketsCovered ?? []).length
              ? `Thị trường: ${(b2b.marketsCovered ?? []).join(', ')}`
              : '',
            (b2b.dealTypes ?? []).length ? `Loại hình: ${(b2b.dealTypes ?? []).join(', ')}` : '',
            (b2b.sellingStages ?? []).length
              ? `Giai đoạn: ${(b2b.sellingStages ?? []).join(', ')}`
              : '',
            b2b.salesHighlights,
          ]),
      `Kỹ năng: ${(b2b.skills ?? []).join(', ')}`,
    ]
      .filter(Boolean)
      .join('. ');
  }

  private explainPair(
    semantic: number,
    job: Parameters<typeof jobToB2bMatchInput>[0],
    candidate: CandidateWithSales,
  ): MatchExplanation {
    if (shouldUseTechnicalMatchEngine(job)) {
      return explainTechnicalJobCandidate(job, candidate);
    }
    if (shouldUseSalesMatchEngine(job)) {
      return explainSalesJobCandidate(job, candidate);
    }
    return buildB2bExplanation({
      semantic,
      candidate: toB2bCandidateFromRecords({
        profile: candidate.profile,
        experiences: candidate.experiences,
        skills: candidate.skills.map((s) => s.name),
      }),
      job: jobToB2bMatchInput(job),
    });
  }

  /** Tính điểm phù hợp giữa một ứng viên và một tin tuyển dụng (dùng khi ứng tuyển). */
  async computePairMatch(jobId: string, candidateId: string): Promise<MatchExplanation> {
    const [job, candidate] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId }, include: { skills: true } }),
      this.prisma.candidate.findUnique({
        where: { id: candidateId },
        include: CANDIDATE_MATCH_INCLUDE,
      }),
    ]);
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (!candidate) throw new NotFoundException('Không tìm thấy ứng viên');

    let semantic = 0;
    try {
      const [jobVec, candVec] = await Promise.all([
        this.ai.embed(buildJobText(job, job.skills.map((s) => s.name))),
        this.ai.embed(this.buildCandidateText(candidate)),
      ]);
      semantic = cosine(jobVec, candVec);
    } catch (err) {
      this.logger.warn(`Không tính được embedding khi so khớp: ${String(err)}`);
    }

    return this.explainPair(semantic, job, candidate);
  }

  /**
   * Mức phù hợp của ứng viên đang đăng nhập với một tin.
   * Cùng explainPair với danh sách gợi ý AI.
   */
  async jobFitForCandidate(user: AuthenticatedUser, jobRef: string): Promise<MatchExplanation> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
    });
    if (!candidate) throw new NotFoundException('Chưa có hồ sơ ứng viên');

    const job = await this.prisma.job.findFirst({
      where: {
        ...(looksLikeUuid(jobRef) ? { id: jobRef } : { slug: jobRef }),
        tenantId: user.tenantId,
        status: 'published',
        isDeleted: false,
      },
      include: { skills: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');

    const criteriaEngine = shouldUseSalesMatchEngine(job) || shouldUseTechnicalMatchEngine(job);
    const semantic = criteriaEngine ? 0 : await this.semanticScoreForJob(job.id, candidate);
    return this.explainPair(semantic, job, candidate);
  }

  /** Cosine lưu trên tin. Không có embedding thì 0 — cùng đường gợi ý AI. */
  private async semanticScoreForJob(jobId: string, candidate: CandidateWithSales): Promise<number> {
    try {
      const candVec = await this.ai.embed(this.buildCandidateText(candidate));
      const literal = `[${candVec.join(',')}]`;
      const rows = await this.prisma.$queryRaw<{ score: number }[]>`
        SELECT (1 - (embedding <=> ${literal}::vector))::float AS score
        FROM recruitment.job
        WHERE id = ${jobId}::uuid AND embedding IS NOT NULL`;
      const score = rows[0]?.score;
      return typeof score === 'number' && Number.isFinite(score) ? score : 0;
    } catch (err) {
      this.logger.warn(`Không tính được mức phù hợp tin ${jobId}: ${String(err)}`);
      return 0;
    }
  }

  /**
   * Gợi ý ứng viên phù hợp cho một tin (NTD chọn JD → Tìm ngay).
   * Chấm bằng engine Sales B2B / Kỹ thuật đã code — không thay bằng full-text search.
   * Vector chỉ dùng để ưu tiên đưa vào pool khi có embedding.
   */
  async candidatesForJob(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const { companyId } = await this.companies.requireUserCompany(user.id);
    if (job.companyId !== companyId) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    const entitlements = await this.sourcing.getEntitlements(companyId);
    const endsAt = entitlements.assignment?.endsAt;
    const hasSourcingPlan = Boolean(
      entitlements.assignment?.isActive && (!endsAt || new Date(endsAt).getTime() >= Date.now()),
    );
    if (!hasSourcingPlan) {
      try {
        await this.credit.consumeAction({
          tenantId: user.tenantId,
          companyId,
          action: 'view_match_summary',
          jobId: job.id,
          actorUserId: user.id,
          actorEmail: user.email ?? undefined,
          oncePerJob: true,
        });
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        if (
          err instanceof BadRequestException &&
          typeof err.getResponse() === 'object' &&
          (err.getResponse() as { code?: string }).code === 'INSUFFICIENT_CREDIT'
        ) {
          throw err;
        }
        this.logger.warn(`Failed to record credit ledger for view_match_summary: ${String(err)}`);
      }
    }
    const ranked = await this.rankJobCandidates(user, jobId);
    if (!hasSourcingPlan || ranked.length === 0) return ranked;
    const assignmentId = entitlements.assignment?.id;
    if (!assignmentId) return ranked;
    const opened = await this.prisma.billingSourcingUsage.findMany({
      where: { companyId, assignmentId, kind: 'profile_open' },
      select: { note: true },
    });
    const openedIds = new Set(
      opened.flatMap((row) =>
        row.note?.startsWith('open:') ? [row.note.slice(5).split(':')[0]] : [],
      ),
    );
    return ranked.map((row) => ({
      ...row,
      viewed: row.viewed || openedIds.has(row.candidateId),
    }));
  }

  /**
   * Top ứng viên từng tin đang mở — cùng rankJobCandidates với AI gợi ý ứng viên.
   * Không trừ Credit: chỉ để tổng quan và Copilot hiện đúng %.
   */
  async openJobMatchBoards(user: AuthenticatedUser): Promise<OpenJobMatchBoard[]> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const jobs = await this.prisma.job.findMany({
      where: { companyId, isDeleted: false, status: JobStatus.Published },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, code: true },
    });
    const boards: OpenJobMatchBoard[] = [];
    for (const job of jobs) {
      const ranked = await this.rankJobCandidates(user, job.id);
      boards.push({
        jobId: job.id,
        jobTitle: job.title,
        jobCode: job.code,
        candidates: ranked.slice(0, 3),
      });
    }
    return boards;
  }

  /**
   * iLink săn ứng viên cho vị trí đã gắn trong gói Săn.
   * Không trừ Credit xem matching — phí nằm trong gói. Mở hồ sơ mới trừ lượt mở.
   */
  async candidatesForSourcing(
    user: AuthenticatedUser,
    jobId: string,
    forceNewRound = false,
  ): Promise<CandidateMatchView[]> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    const entitlements = await this.sourcing.getEntitlements(companyId);
    const endsAt = entitlements.assignment?.endsAt;
    const cycleOpen = !endsAt || new Date(endsAt).getTime() >= Date.now();
    if (!entitlements.assignment?.isActive || !cycleOpen) {
      throw new ForbiddenException({
        code: 'SOURCING_PLAN_REQUIRED',
        message: 'Bạn chưa có gói Săn nhân sự đang dùng.',
      });
    }
    const linked = await this.prisma.billingSourcingEngagement.findFirst({
      where: { companyId, jobId, assignmentId: entitlements.assignment.id },
      select: { id: true, companyId: true, assignmentId: true, jobId: true, title: true },
    });
    if (!linked) {
      throw new ForbiddenException({
        code: 'SOURCING_POSITION_REQUIRED',
        message: 'Hãy mở vị trí Săn gắn với tin này trước.',
      });
    }
    const ranked = await this.rankJobCandidates(user, jobId);

    // Nếu vị trí Săn vừa tạo chưa có đợt quét nào thì ghi nhận ngay Đợt tìm kiếm #1
    const existingScans = await this.prisma.billingSourcingUsage.count({
      where: {
        companyId,
        assignmentId: entitlements.assignment.id,
        engagementId: linked.id,
        kind: 'auto_scan',
      },
    });
    if (existingScans === 0 || forceNewRound) {
      const trigger = existingScans === 0 ? 'initial' : 'manual';
      await this.recordSourcingScanRound(linked, ranked, trigger, user.id).catch((err) => {
        this.logger.warn(`Không lưu được đợt quét đầu tiên cho vị trí ${linked.id}: ${String(err)}`);
      });
    }

    if (ranked.length === 0) return ranked;
    const opened = await this.prisma.billingSourcingUsage.findMany({
      where: {
        companyId,
        assignmentId: entitlements.assignment.id,
        kind: 'profile_open',
      },
      select: { note: true },
    });
    const openedIds = new Set(
      opened.flatMap((row) =>
        row.note?.startsWith('open:') ? [row.note.slice(5).split(':')[0]] : [],
      ),
    );
    return ranked.map((row) => ({
      ...row,
      viewed: row.viewed || openedIds.has(row.candidateId),
    }));
  }

  /**
   * Lịch quét tự động 2 giờ/lần trong giờ hành chính (08:00, 10:00, 12:00, 14:00, 16:00, 18:00, Thứ 2 – Thứ 7, giờ VN).
   * Tự động đối chiếu toàn bộ ứng viên theo JD Sales B2B / Kỹ thuật của các vị trí Săn đang mở.
   */
  @Cron('0 0 8,10,12,14,16,18 * * 1-6', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runScheduledSourcingScans(): Promise<void> {
    const now = new Date();
    const activeEngagements = await this.prisma.billingSourcingEngagement.findMany({
      where: {
        status: { not: 'closed' },
        jobId: { not: null },
        assignment: {
          isActive: true,
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      },
      select: {
        id: true,
        companyId: true,
        assignmentId: true,
        jobId: true,
        title: true,
      },
    });

    for (const eng of activeEngagements) {
      if (!eng.jobId) continue;
      try {
        const company = await this.prisma.company.findUnique({
          where: { id: eng.companyId },
          select: { id: true, tenantId: true, name: true },
        });
        if (!company) continue;
        const ranked = await this.rankJobCandidatesByCompany(
          eng.companyId,
          company.tenantId,
          eng.jobId,
        );
        await this.recordSourcingScanRound(eng, ranked, 'cron');
      } catch (err) {
        this.logger.warn(
          `Quét Săn tự động 2h/lần lỗi cho engagement=${eng.id}: ${String(err)}`,
        );
      }
    }
  }

  private async recordSourcingScanRound(
    engagement: {
      id: string;
      companyId: string;
      assignmentId: string;
      jobId: string | null;
      title: string;
    },
    ranked: CandidateMatchView[],
    trigger: 'initial' | 'cron' | 'manual',
    actorUserId?: string,
  ): Promise<void> {
    const potentialRows = ranked
      .filter((r) => !r.applied)
      .sort((a, b) => b.match.score - a.match.score);

    const prevUsageRows = await this.prisma.billingSourcingUsage.findMany({
      where: {
        companyId: engagement.companyId,
        assignmentId: engagement.assignmentId,
        engagementId: engagement.id,
        kind: 'auto_scan',
      },
      orderBy: { createdAt: 'asc' },
      select: { note: true },
    });

    const prevBestScore = new Map<string, number>();
    for (const row of prevUsageRows) {
      if (!row.note) continue;
      try {
        const parsed = JSON.parse(row.note) as {
          candidates?: { candidateId: string; score: number }[];
        };
        for (const c of parsed.candidates ?? []) {
          const prev = prevBestScore.get(c.candidateId);
          if (prev === undefined || c.score > prev) {
            prevBestScore.set(c.candidateId, c.score);
          }
        }
      } catch {
        // Bỏ qua dòng không phải JSON
      }
    }

    const roundNumber = prevUsageRows.length + 1;
    const allScoredCandidates: RecruiterSourcingScanCandidateItem[] = potentialRows.map((row) => {
      const raw = row.match.score <= 1 ? row.match.score * 100 : row.match.score;
      const score = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
      const prev = prevBestScore.get(row.candidateId);
      const isNew = prev === undefined || score - prev >= 1;
      return {
        candidateId: row.candidateId,
        score,
        isNew,
      };
    });

    // Mỗi đợt quét lấy dao động 10–15 ứng viên tiềm năng (ưu tiên ứng viên mới + điểm phù hợp cao)
    const targetBatchSize = 10 + ((roundNumber * 3 + engagement.id.charCodeAt(0)) % 6); // 10..15
    let candidates: RecruiterSourcingScanCandidateItem[];
    if (allScoredCandidates.length <= targetBatchSize) {
      candidates = allScoredCandidates;
    } else {
      const freshOnes = allScoredCandidates.filter((c) => c.isNew);
      const seenOnes = allScoredCandidates.filter((c) => !c.isNew);
      const offset = ((roundNumber - 1) * 5) % Math.max(1, seenOnes.length);
      const rotatedSeen = [...seenOnes.slice(offset), ...seenOnes.slice(0, offset)];
      candidates = [...freshOnes, ...rotatedSeen]
        .slice(0, targetBatchSize)
        .sort((a, b) => {
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          return b.score - a.score;
        });
    }

    const newItems = candidates.filter((c) => c.isNew);
    let emailSent = false;

    if (trigger === 'cron' && newItems.length > 0) {
      emailSent = await this.notifyRecruiterNewSourcingMatches(
        engagement,
        roundNumber,
        potentialRows.filter((r) => newItems.some((n) => n.candidateId === r.candidateId)),
      );
    }

    const payload = {
      roundNumber,
      trigger,
      totalMatched: candidates.length,
      newCount: newItems.length,
      emailSent,
      candidates,
    };

    await this.prisma.billingSourcingUsage.create({
      data: {
        companyId: engagement.companyId,
        assignmentId: engagement.assignmentId,
        engagementId: engagement.id,
        jobId: engagement.jobId,
        kind: 'auto_scan',
        note: JSON.stringify(payload),
        createdBy: actorUserId && looksLikeUuid(actorUserId) ? actorUserId : null,
      },
    });
  }

  private async notifyRecruiterNewSourcingMatches(
    engagement: {
      id: string;
      companyId: string;
      title: string;
    },
    roundNumber: number,
    newMatches: CandidateMatchView[],
  ): Promise<boolean> {
    if (newMatches.length === 0) return false;
    const company = await this.prisma.company.findUnique({
      where: { id: engagement.companyId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
      },
    });
    if (!company) return false;

    const recipients = new Map<string, { userId: string; email: string | null }>();
    for (const m of company.members) {
      if (m.user) {
        recipients.set(m.user.id, { userId: m.user.id, email: m.user.email });
      }
    }
    if (company.createdBy && !recipients.has(company.createdBy)) {
      const creator = await this.prisma.user.findUnique({
        where: { id: company.createdBy },
        select: { id: true, email: true },
      });
      if (creator) recipients.set(creator.id, { userId: creator.id, email: creator.email });
    }

    const topLines = newMatches.slice(0, 5).map((m) => {
      const pct = Math.round((m.match.score <= 1 ? m.match.score * 100 : m.match.score) * 10) / 10;
      return `• ${m.displayName} — Phù hợp ${pct}%${m.currentPosition ? ` (${m.currentPosition})` : ''}`;
    });

    const subject = `[inlink Săn nhân sự] +${newMatches.length} ứng viên phù hợp mới cho «${engagement.title}» (Đợt #${roundNumber})`;
    const text = [
      `Xin chào ${company.name},`,
      '',
      `Hệ thống Săn nhân sự tự động (2 giờ/lần) của inlink vừa hoàn tất Đợt tìm kiếm #${roundNumber} cho vị trí «${engagement.title}» và phát hiện ${newMatches.length} ứng viên tiềm năng mới phù hợp:`,
      '',
      ...topLines,
      '',
      'Xem chi tiết danh sách ứng viên tại mục Săn nhân sự trên inlink (/recruiter/sourcing).',
    ].join('\n');

    const htmlList = newMatches
      .slice(0, 5)
      .map((m) => {
        const pct = Math.round((m.match.score <= 1 ? m.match.score * 100 : m.match.score) * 10) / 10;
        return `<li><strong>${m.displayName}</strong> — Phù hợp <strong>${pct}%</strong>${m.currentPosition ? ` (${m.currentPosition})` : ''}</li>`;
      })
      .join('');
    const html = [
      `<p>Xin chào <strong>${company.name}</strong>,</p>`,
      `<p>Hệ thống Săn nhân sự tự động (2 giờ/lần) của <strong>inlink</strong> vừa hoàn tất <strong>Đợt tìm kiếm #${roundNumber}</strong> cho vị trí «<strong>${engagement.title}</strong>» và phát hiện <strong>${newMatches.length} ứng viên tiềm năng mới</strong>:</p>`,
      `<ul>${htmlList}</ul>`,
      `<p>Truy cập mục <strong>Săn nhân sự</strong> trên inlink để xem chi tiết từng đợt tìm kiếm và mở hồ sơ ứng viên.</p>`,
    ].join('');

    let sentAny = false;
    for (const r of recipients.values()) {
      await this.notifications
        .createInApp({
          tenantId: company.tenantId,
          userId: r.userId,
          type: 'sourcing.new_matches',
          title: `+${newMatches.length} ứng viên tiềm năng mới (Đợt #${roundNumber})`,
          body: `Vị trí «${engagement.title}» vừa có ${newMatches.length} ứng viên phù hợp mới từ đợt quét tự động.`,
          link: '/recruiter/sourcing',
          entityType: 'sourcing_engagement',
          entityId: engagement.id,
        })
        .catch(() => undefined);

      if (r.email) {
        await this.notifications.emailSafe({
          to: r.email,
          subject,
          text,
          html,
        });
        sentAny = true;
      }
    }

    // Hook sẵn sàng kết nối Zalo ZNS trong tương lai
    this.notifyZaloSourcingPlaceholder(company.id, engagement.title, roundNumber, newMatches.length);
    return sentAny;
  }

  private notifyZaloSourcingPlaceholder(
    companyId: string,
    title: string,
    roundNumber: number,
    newCount: number,
  ): void {
    this.logger.debug(
      `[Zalo Hook Placeholder] company=${companyId} title="${title}" round=#${roundNumber} newMatches=${newCount}`,
    );
  }

  private async rankJobCandidates(user: AuthenticatedUser, jobId: string): Promise<CandidateMatchView[]> {
    const { companyId } = await this.companies.requireUserCompany(user.id);
    return this.rankJobCandidatesByCompany(companyId, user.tenantId, jobId);
  }

  private async rankJobCandidatesByCompany(
    companyId: string,
    tenantId: string,
    jobId: string,
  ): Promise<CandidateMatchView[]> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: true },
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (job.companyId !== companyId) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }
    const jobTrack = jobMatchTrack(job);

    const poolIds = new Set<string>();
    const appliedIds = new Set<string>();

    // 1) Hồ sơ đã nộp vào đúng tin — luôn đưa vào pool để chấm lại bằng engine JD
    const applied = await this.prisma.application.findMany({
      where: { jobId, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATE_POOL,
      select: { candidateId: true },
    });
    for (const a of applied) {
      appliedIds.add(a.candidateId);
      poolIds.add(a.candidateId);
    }

    // 2) Semantic recall (tuỳ chọn) — chỉ lấy ứng viên đúng nhánh (Sales ↔ Sales, KT ↔ KT)
    try {
      const vector = await this.ai.embed(buildJobText(job, job.skills.map((s) => s.name)));
      const literal = `[${vector.join(',')}]`;
      const rows = jobTrack
        ? await this.prisma.$queryRaw<{ candidate_id: string }[]>`
            SELECT csi.candidate_id
            FROM candidate.candidate_search_index csi
            INNER JOIN candidate.candidate_profile cp ON cp.candidate_id = csi.candidate_id
            WHERE csi.tenant_id = ${tenantId}
              AND csi.embedding IS NOT NULL
              AND cp.job_track = ${jobTrack}
            ORDER BY csi.embedding <=> ${literal}::vector
            LIMIT ${CANDIDATE_POOL}`
        : await this.prisma.$queryRaw<{ candidate_id: string }[]>`
            SELECT candidate_id
            FROM candidate.candidate_search_index
            WHERE tenant_id = ${tenantId} AND embedding IS NOT NULL
            ORDER BY embedding <=> ${literal}::vector
            LIMIT ${CANDIDATE_POOL}`;
      for (const r of rows) {
        poolIds.add(r.candidate_id);
        if (poolIds.size >= CANDIDATE_POOL) break;
      }
    } catch (err) {
      this.logger.warn(`Semantic recall (pool) lỗi: ${String(err)}`);
    }

    if (jobTrack) {
      const otherTrack = await this.prisma.candidate.findMany({
        where: {
          id: { in: [...poolIds].filter((id) => !appliedIds.has(id)) },
          profile: { is: { jobTrack: { not: jobTrack } } },
        },
        select: { id: true },
      });
      for (const c of otherTrack) poolIds.delete(c.id);
    }

    // 3) Bổ sung ứng viên có hồ sơ (cùng tenant) để engine Sales/KT có đủ dữ liệu chấm
    if (poolIds.size < CANDIDATE_POOL) {
      const recent = await this.prisma.candidate.findMany({
        where: {
          tenantId,
          isDeleted: false,
          profile: jobTrack ? { is: { jobTrack } } : { isNot: null },
          ...(poolIds.size > 0 ? { id: { notIn: [...poolIds] } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: CANDIDATE_POOL - poolIds.size,
        select: { id: true },
      });
      for (const c of recent) poolIds.add(c.id);
    }

    // Nếu số ứng viên tiềm năng cùng nhánh quá ít (< 15), bổ sung thêm ứng viên trong mạng lưới cùng tenant
    const nonAppliedCount = [...poolIds].filter((id) => !appliedIds.has(id)).length;
    if (nonAppliedCount < 15) {
      const fallbackCandidates = await this.prisma.candidate.findMany({
        where: {
          tenantId,
          isDeleted: false,
          ...(poolIds.size > 0 ? { id: { notIn: [...poolIds] } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 15 - nonAppliedCount,
        select: { id: true },
      });
      for (const c of fallbackCandidates) poolIds.add(c.id);
    }

    if (poolIds.size === 0) return [];

    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: [...poolIds] }, isDeleted: false },
      include: CANDIDATE_MATCH_INCLUDE,
    });

    // Điểm cuối = engine Sales / Kỹ thuật (explainPair), không dùng điểm embedding.
    // Ứng viên đã nộp vào tin luôn giữ lại để NTD thấy đủ hồ sơ ứng tuyển.
    let eligible = candidates.filter(
      (c) => appliedIds.has(c.id) || sameMatchTrack(jobTrack, candidateMatchTrack(c)),
    );
    const eligiblePotentialCount = eligible.filter((c) => !appliedIds.has(c.id)).length;
    if (eligiblePotentialCount < 15 && candidates.length > eligible.length) {
      const eligibleIdSet = new Set(eligible.map((c) => c.id));
      const extras = candidates
        .filter((c) => !eligibleIdSet.has(c.id))
        .slice(0, 15 - eligiblePotentialCount);
      eligible = [...eligible, ...extras];
    }
    const scored = eligible.map((c) => {
      const explanation = this.explainPair(0, job, c);
      return {
        candidateId: c.id,
        displayName: c.displayName,
        currentPosition: c.profile?.currentPosition ?? null,
        industry: c.profile?.industry ?? null,
        location: candidateLocationLabel(c.profile),
        match: explanation,
        applied: appliedIds.has(c.id),
      };
    });

    const appliedRows = scored
      .filter((r) => r.applied)
      .sort((a, b) => b.match.score - a.match.score);
    const networkRows = scored
      .filter((r) => !r.applied && r.match.score >= MIN_ENGINE_SCORE)
      .sort((a, b) => b.match.score - a.match.score);
    const ranked = [...appliedRows, ...networkRows].slice(0, MATCH_LIMIT);
    const viewedIds = await this.viewedCandidateIds(
      companyId,
      ranked.map((row) => row.candidateId),
    );

    return ranked.map(
      (row): CandidateMatchView => ({
        candidateId: row.candidateId,
        displayName: row.displayName,
        currentPosition: row.currentPosition,
        industry: row.industry,
        location: row.location,
        match: row.match,
        applied: row.applied,
        viewed: viewedIds.has(row.candidateId),
      }),
    );
  }

  /** Công ty đã mở hồ sơ: lượt xem có phí, hoặc mốc xem miễn phí. */
  private async viewedCandidateIds(companyId: string, candidateIds: string[]): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const rows = await this.prisma.billingCreditTransaction.findMany({
      where: {
        companyId,
        candidateId: { in: candidateIds },
        action: {
          in: ['view_profile', 'view_profile_high_match', 'view_applicant', 'reopen_profile'],
        },
      },
      select: { candidateId: true },
      distinct: ['candidateId'],
    });
    return new Set(rows.flatMap((row) => (row.candidateId ? [row.candidateId] : [])));
  }

  /** Gợi ý tin tuyển dụng phù hợp cho ứng viên đang đăng nhập. */
  async jobsForCandidate(user: AuthenticatedUser): Promise<JobMatchView[]> {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId: user.id },
      include: CANDIDATE_MATCH_INCLUDE,
    });
    if (!candidate) throw new NotFoundException('Chưa có hồ sơ ứng viên');
    const candTrack = candidateMatchTrack(candidate);
    const fetchLimit = candTrack ? MATCH_LIMIT * 3 : MATCH_LIMIT;
    const fitsTrack = (j: Parameters<typeof jobMatchTrack>[0]) =>
      sameMatchTrack(jobMatchTrack(j), candTrack);

    let rows: { id: string; score: number }[] = [];
    try {
      const vector = await this.ai.embed(this.buildCandidateText(candidate));
      const literal = `[${vector.join(',')}]`;
      rows = await this.prisma.$queryRaw<{ id: string; score: number }[]>`
        SELECT id, (1 - (embedding <=> ${literal}::vector))::float AS score
        FROM recruitment.job
        WHERE tenant_id = ${user.tenantId}
          AND status = 'published'
          AND is_deleted = false
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${fetchLimit}`;
    } catch (err) {
      this.logger.warn(`Semantic matching (job) lỗi: ${String(err)}`);
    }

    // Fallback: tin chưa có embedding (vd. seed demo) → xếp theo tiêu chí B2B + kỹ năng.
    if (rows.length === 0) {
      const published = await this.prisma.job.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'published',
          isDeleted: false,
        },
        include: { skills: true, company: { select: { id: true, name: true, slug: true } } },
        orderBy: { publishedAt: 'desc' },
        take: fetchLimit,
      });
      const sameTrackJobs = published.filter(fitsTrack).slice(0, MATCH_LIMIT);
      await backfillMissingJobSlugs(this.prisma, sameTrackJobs);
      await backfillMissingCompanySlugs(
        this.prisma,
        sameTrackJobs.map((j) => j.company),
      );
      return sameTrackJobs
        .map((j) => {
          const explanation = this.explainPair(0, j, candidate);
          return this.toJobMatchView(j, explanation);
        })
        .filter((j) => j.match.score > 0 || candidate.skills.length === 0)
        .sort((a, b) => b.match.score - a.match.score);
    }

    const scoreMap = new Map(rows.map((r) => [r.id, r.score]));
    const fetched = await this.prisma.job.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: { skills: true, company: { select: { id: true, name: true, slug: true } } },
    });
    const jobs = fetched
      .filter(fitsTrack)
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, MATCH_LIMIT);

    await backfillMissingJobSlugs(this.prisma, jobs);
    await backfillMissingCompanySlugs(
      this.prisma,
      jobs.map((j) => j.company),
    );

    return jobs
      .map((j) => {
        const explanation = this.explainPair(scoreMap.get(j.id) ?? 0, j, candidate);
        return this.toJobMatchView(j, explanation);
      })
      .sort((a, b) => b.match.score - a.match.score);
  }

  private toJobMatchView(
    j: {
      id: string;
      slug?: string | null;
      code: string;
      title: string;
      location: string | null;
      industry: string | null;
      jobLevel: string | null;
      experienceBand: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      publishedAt: Date | null;
      skills: { name: string; required: boolean }[];
      company: { id: string; name: string; slug?: string | null };
    },
    explanation: MatchExplanation,
  ): JobMatchView {
    return {
      jobId: j.id,
      slug: j.slug ?? j.id,
      code: j.code,
      title: j.title,
      companyId: j.company.id,
      companySlug: j.company.slug ?? null,
      companyName: j.company.name,
      location: j.location,
      industry: j.industry,
      jobLevel: j.jobLevel,
      experienceBand: j.experienceBand,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      skills: j.skills
        .map((s) => plainLabel(s.name))
        .filter(Boolean)
        .filter((name, index, all) => all.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index)
        .slice(0, 6),
      publishedAt: j.publishedAt?.toISOString() ?? null,
      match: explanation,
    };
  }
}
