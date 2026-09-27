import { Injectable } from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  CompanyStatus,
  JobStatus,
  cmsAuthorPublicPath,
  isJobExpiredForSeo,
  jobPublicPath,
  type CmsAuthorTrustItem,
  type CmsJobSchemaIssue,
  type CmsJobSchemaItem,
  type CmsTrustGrade,
  type CmsTrustReport,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

function grade(score: number): CmsTrustGrade {
  if (score >= 85) return 'great';
  if (score >= 70) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

function plainLength(value: string | null | undefined): number {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

@Injectable()
export class SeoTrustService {
  constructor(private readonly prisma: PrismaService) {}

  async report(): Promise<CmsTrustReport> {
    const [authors, jobs] = await Promise.all([this.authors(), this.jobs()]);
    return { generatedAt: new Date().toISOString(), authors, jobs };
  }

  private async authors(): Promise<CmsTrustReport['authors']> {
    const live = {
      isDeleted: false,
      type: CmsContentType.Post,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [profiles, counts] = await Promise.all([
      this.prisma.cmsAuthorProfile.findMany({
        take: 200,
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.cmsPost.groupBy({
        by: ['authorId'],
        where: live,
        _count: { _all: true },
      }),
    ]);
    const postCount = new Map(counts.map((row) => [row.authorId, row._count._all]));
    const profileIds = new Set(profiles.map((row) => row.userId));
    const missingIds = counts.map((row) => row.authorId).filter((id) => !profileIds.has(id));
    const users =
      missingIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: missingIds } },
            select: { id: true, displayName: true },
          });
    const userName = new Map(users.map((row) => [row.id, row.displayName]));

    const items: CmsAuthorTrustItem[] = [
      ...profiles.map((row) => this.scoreAuthor(row, postCount.get(row.userId) || 0)),
      ...missingIds.map((userId) =>
        this.scoreAuthor(
          {
            userId,
            displayName: userName.get(userId) || 'Tác giả chưa có hồ sơ',
            title: null,
            bio: null,
            avatarUrl: null,
            worksFor: null,
            slug: null,
            isPublic: false,
            linkedinUrl: null,
            websiteUrl: null,
            facebookUrl: null,
            twitterUrl: null,
            youtubeUrl: null,
          },
          postCount.get(userId) || 0,
        ),
      ),
    ].sort((a, b) => a.score - b.score || b.postCount - a.postCount);

    const averageScore =
      items.length === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
    return { count: items.length, averageScore, items };
  }

  private scoreAuthor(
    row: {
      userId: string;
      displayName: string;
      title: string | null;
      bio: string | null;
      avatarUrl: string | null;
      worksFor: string | null;
      slug: string | null;
      isPublic: boolean;
      linkedinUrl: string | null;
      websiteUrl: string | null;
      facebookUrl: string | null;
      twitterUrl: string | null;
      youtubeUrl: string | null;
    },
    published: number,
  ): CmsAuthorTrustItem {
    const checks: Array<{ label: string; points: number; ok: boolean }> = [
      { label: 'Tên hiển thị', points: 8, ok: Boolean(row.displayName?.trim()) },
      { label: 'Chức danh', points: 10, ok: Boolean(row.title?.trim()) },
      { label: 'Bio kinh nghiệm', points: 18, ok: plainLength(row.bio) >= 80 },
      { label: 'Ảnh đại diện', points: 8, ok: Boolean(row.avatarUrl?.trim()) },
      { label: 'worksFor', points: 10, ok: Boolean(row.worksFor?.trim()) },
      { label: 'Trang tác giả public', points: 12, ok: Boolean(row.isPublic && row.slug) },
      { label: 'LinkedIn', points: 16, ok: Boolean(row.linkedinUrl?.trim()) },
      {
        label: 'SameAs khác',
        points: 8,
        ok: Boolean(
          row.websiteUrl?.trim() || row.facebookUrl?.trim() || row.twitterUrl?.trim() || row.youtubeUrl?.trim(),
        ),
      },
      { label: 'Bài đã xuất bản', points: 10, ok: published > 0 },
    ];
    const score = checks.reduce((sum, check) => sum + (check.ok ? check.points : 0), 0);
    return {
      userId: row.userId,
      displayName: row.displayName,
      editPath: '/admin/author',
      publicPath: row.isPublic && row.slug ? cmsAuthorPublicPath(row.slug) : null,
      score,
      grade: grade(score),
      postCount: published,
      missing: checks.filter((check) => !check.ok).map((check) => check.label),
    };
  }

  private async jobs(): Promise<CmsTrustReport['jobs']> {
    const rows = await this.prisma.job.findMany({
      where: {
        isDeleted: false,
        status: JobStatus.Published,
        company: { isDeleted: false, status: CompanyStatus.Active },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        location: true,
        salaryMin: true,
        salaryMax: true,
        deadline: true,
        employmentType: true,
        company: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });
    let valid = 0;
    let missingSalary = 0;
    let missingDeadline = 0;
    let expired = 0;
    const items: CmsJobSchemaItem[] = [];
    for (const row of rows) {
      const issues = this.jobIssues(row);
      if (issues.some((issue) => issue.code === 'salary')) missingSalary += 1;
      if (issues.some((issue) => issue.code === 'deadline')) missingDeadline += 1;
      if (issues.some((issue) => issue.code === 'expired')) expired += 1;
      if (issues.length === 0) {
        valid += 1;
        continue;
      }
      items.push({
        id: row.id,
        title: row.title,
        companyName: row.company.name,
        editPath: '/admin/jobs',
        publicPath: jobPublicPath(row),
        issues,
      });
    }
    items.sort((a, b) => {
      const rank = (issue: CmsJobSchemaIssue) => (issue.severity === 'critical' ? 0 : 1);
      const aRank = Math.min(...a.issues.map(rank));
      const bRank = Math.min(...b.issues.map(rank));
      return aRank - bRank || b.issues.length - a.issues.length;
    });
    return {
      scanned: rows.length,
      valid,
      withIssues: items.length,
      missingSalary,
      missingDeadline,
      expired,
      items: items.slice(0, 60),
    };
  }

  private jobIssues(row: {
    title: string;
    description: string;
    location: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    deadline: Date | null;
    employmentType: string | null;
    company: { name: string };
  }): CmsJobSchemaIssue[] {
    const issues: CmsJobSchemaIssue[] = [];
    const deadline = row.deadline ? row.deadline.toISOString() : null;
    if (!row.title?.trim()) {
      issues.push({ code: 'title', severity: 'critical', label: 'Thiếu title' });
    }
    if (plainLength(row.description) < 80) {
      issues.push({ code: 'description', severity: 'critical', label: 'Mô tả quá ngắn' });
    }
    if (isJobExpiredForSeo({ status: JobStatus.Published, deadline })) {
      issues.push({ code: 'expired', severity: 'critical', label: 'Hạn nộp đã qua' });
    }
    if (!deadline) {
      issues.push({
        code: 'deadline',
        severity: 'warning',
        label: 'Không có hạn nộp — validThrough đang tự cộng 30 ngày',
      });
    }
    if (row.salaryMin == null && row.salaryMax == null) {
      issues.push({ code: 'salary', severity: 'warning', label: 'Thiếu baseSalary' });
    }
    if (!row.location?.trim()) {
      issues.push({ code: 'location', severity: 'warning', label: 'Thiếu jobLocation' });
    }
    if (!row.employmentType?.trim()) {
      issues.push({
        code: 'employment',
        severity: 'warning',
        label: 'Thiếu employmentType — schema đang giả định FULL_TIME',
      });
    }
    return issues;
  }
}
