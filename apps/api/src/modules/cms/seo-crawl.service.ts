import { Injectable } from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  CompanyStatus,
  JobStatus,
  cmsAuthorPublicPath,
  cmsCategoryPublicPath,
  cmsPagePublicPath,
  cmsPostPublicPath,
  companyPublicPath,
  jobListingPath,
  jobPublicPath,
  type CmsCrawlReport,
  type CmsIndexingMonitor,
  type CmsOrphanItem,
  type CmsRedirectIssue,
  type CmsSitemapHealthItem,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';

const QUOTA_LIMIT = 200;
const BLOG_HOME_LINKS = 24;

function siteUrl(): string {
  return (
    process.env.PUBLIC_SITE_URL ||
    process.env.WEB_ORIGIN ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function pathOnly(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(value)) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (
        host !== 'inlink.vn' &&
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        !host.endsWith('.inlink.vn')
      ) {
        return null;
      }
      return url.pathname.replace(/\/$/, '') || '/';
    } catch {
      return null;
    }
  }
  if (!value.startsWith('/')) return null;
  const path = value.split(/[?#]/)[0].replace(/\/$/, '');
  return path || '/';
}

function collectPaths(html: string, into: Set<string>): void {
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const path = pathOnly(match[1] || match[2] || match[3] || '');
    if (path) into.add(path);
  }
}

function faqText(json: unknown): string {
  if (!Array.isArray(json)) return '';
  return json
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const answer = (item as { answer?: unknown }).answer;
      return typeof answer === 'string' ? answer : '';
    })
    .join('\n');
}

@Injectable()
export class SeoCrawlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indexing: GoogleIndexingService,
  ) {}

  async report(): Promise<CmsCrawlReport> {
    const base = siteUrl();
    const [indexing, sitemaps, orphans, redirectIssues] = await Promise.all([
      this.indexingMonitor(),
      this.sitemapHealth(base),
      this.orphanPages(),
      this.redirectIssues(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      indexing,
      sitemaps,
      orphans,
      redirectIssues,
    };
  }

  private async indexingMonitor(): Promise<CmsIndexingMonitor> {
    const empty: CmsIndexingMonitor = {
      configured: this.indexing.isConfigured(),
      quotaLimit: QUOTA_LIMIT,
      quotaUsed: 0,
      todayUpdated: 0,
      todayDeleted: 0,
      todayErrors: 0,
      http403: 0,
      http429: 0,
      alerts: [],
      recent: [],
    };
    if (!empty.configured) {
      empty.alerts.push('Chưa có GOOGLE_INDEXING_CREDENTIALS_JSON — API chưa gửi URL nào.');
    }
    try {
      const grouped = await this.prisma.$queryRaw<
        Array<{ type: string; status_code: number | null; ok: boolean; n: number }>
      >`
        SELECT type, status_code, ok, count(*)::int AS n
        FROM shared.indexing_notification
        WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')
        GROUP BY type, status_code, ok
      `;
      for (const row of grouped) {
        const n = Number(row.n) || 0;
        empty.quotaUsed += n;
        if (row.type === 'URL_UPDATED' && row.ok) empty.todayUpdated += n;
        if (row.type === 'URL_DELETED' && row.ok) empty.todayDeleted += n;
        if (!row.ok) empty.todayErrors += n;
        if (row.status_code === 403) empty.http403 += n;
        if (row.status_code === 429) empty.http429 += n;
      }
      const recent = await this.prisma.$queryRaw<
        Array<{
          url: string;
          type: string;
          status_code: number | null;
          ok: boolean;
          error: string | null;
          created_at: Date;
        }>
      >`
        SELECT url, type, status_code, ok, error, created_at
        FROM shared.indexing_notification
        ORDER BY created_at DESC
        LIMIT 20
      `;
      empty.recent = recent.map((row) => ({
        url: row.url,
        type: row.type === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED',
        statusCode: row.status_code,
        ok: row.ok,
        error: row.error,
        createdAt: row.created_at.toISOString(),
      }));
    } catch {
      empty.alerts.push('Chưa đọc được nhật ký Indexing API. Chạy migration indexing_notification.');
    }
    if (empty.quotaUsed >= QUOTA_LIMIT) {
      empty.alerts.push(`Đã chạm quota ${QUOTA_LIMIT} request Indexing API trong hôm nay.`);
    } else if (empty.quotaUsed >= Math.round(QUOTA_LIMIT * 0.8)) {
      empty.alerts.push(`Đã dùng ${empty.quotaUsed}/${QUOTA_LIMIT} request — gần hạn mức ngày.`);
    }
    if (empty.http403 > 0) empty.alerts.push(`${empty.http403} request bị 403 (quyền hoặc credential).`);
    if (empty.http429 > 0) empty.alerts.push(`${empty.http429} request bị 429 (Google từ chối vì quá hạn mức).`);
    return empty;
  }

  private async sitemapHealth(base: string): Promise<CmsSitemapHealthItem[]> {
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [posts, pages, categories, authors, jobs, redirects] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: { ...live, type: CmsContentType.Post },
        select: { slug: true, robotsIndex: true },
        take: 5000,
      }),
      this.prisma.cmsPost.findMany({
        where: { ...live, type: CmsContentType.Page },
        select: { slug: true, robotsIndex: true },
        take: 2000,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { slug: true, robotsIndex: true },
        take: 500,
      }),
      this.prisma.cmsAuthorProfile.findMany({
        where: { isPublic: true, slug: { not: null } },
        select: { slug: true, robotsIndex: true },
        take: 200,
      }),
      this.prisma.job.findMany({
        where: {
          isDeleted: false,
          status: JobStatus.Published,
          company: { isDeleted: false, status: CompanyStatus.Active },
        },
        select: { slug: true, id: true, company: { select: { slug: true, id: true } } },
        take: 5000,
      }),
      this.prisma.cmsRedirect.findMany({ select: { fromPath: true }, take: 2000 }),
    ]);
    const redirectPaths = new Set(
      redirects.map((row) => pathOnly(row.fromPath)).filter((path): path is string => Boolean(path)),
    );
    const conflicts = (paths: string[]) => paths.filter((path) => redirectPaths.has(path)).length;

    const postPaths = posts.filter((row) => row.robotsIndex).map((row) => cmsPostPublicPath(row.slug));
    const pagePaths = pages.filter((row) => row.robotsIndex).map((row) => cmsPagePublicPath(row.slug));
    const categoryPaths = categories
      .filter((row) => row.robotsIndex)
      .map((row) => cmsCategoryPublicPath(row.slug));
    const authorPaths = authors
      .filter((row) => row.robotsIndex && row.slug)
      .map((row) => cmsAuthorPublicPath(row.slug!));
    const jobPaths = jobs.map((row) => jobPublicPath(row));
    const companyPaths = [
      ...new Set(jobs.map((row) => companyPublicPath({ slug: row.company.slug, id: row.company.id }))),
    ];
    const mainPaths = ['/', jobListingPath(), ...companyPaths];

    const item = (
      id: CmsSitemapHealthItem['id'],
      label: string,
      href: string,
      paths: string[],
      excludedNoindex: number,
      extraWarnings: string[] = [],
    ): CmsSitemapHealthItem => {
      const redirectConflicts = conflicts(paths);
      const warnings = [...extraWarnings];
      if (excludedNoindex > 0) warnings.push(`${excludedNoindex} URL noindex đã được loại khỏi sitemap.`);
      if (redirectConflicts > 0) {
        warnings.push(`${redirectConflicts} URL trong sitemap trùng nguồn redirect 301.`);
      }
      if (paths.length > 45000) warnings.push('Gần ngưỡng 50.000 URL của một file sitemap.');
      return {
        id,
        label,
        href,
        urlCount: paths.length,
        excludedNoindex,
        redirectConflicts,
        warnings,
      };
    };

    return [
      item('main', 'Main', `${base}/sitemap/main.xml`, mainPaths, 0),
      item(
        'jobs',
        'Jobs',
        `${base}/sitemap/jobs.xml`,
        jobPaths,
        0,
        jobPaths.length === 0 ? ['Không có tin published để đưa vào sitemap.'] : [],
      ),
      item(
        'blog',
        'Blog',
        `${base}/sitemap/blog.xml`,
        ['/cam-nang', ...categoryPaths, ...authorPaths, ...postPaths],
        posts.filter((row) => !row.robotsIndex).length +
          categories.filter((row) => !row.robotsIndex).length +
          authors.filter((row) => row.slug && !row.robotsIndex).length,
      ),
      item(
        'pages',
        'Pages',
        `${base}/sitemap/pages.xml`,
        pagePaths,
        pages.filter((row) => !row.robotsIndex).length,
      ),
    ];
  }

  private async orphanPages(): Promise<CmsOrphanItem[]> {
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [posts, menus, footer, categories] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: live,
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          categoryId: true,
          bodyHtml: true,
          excerpt: true,
          faqJson: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 500,
      }),
      this.prisma.cmsMenuItem.findMany({ select: { url: true, objectType: true, objectId: true }, take: 500 }),
      this.prisma.cmsFooterSettings.findFirst({ select: { footer1Columns: true, footer2Columns: true } }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { description: true, faqJson: true },
        take: 200,
      }),
    ]);
    const inbound = new Set<string>(['/cam-nang', jobListingPath(), '/']);
    for (const item of menus) {
      const path = pathOnly(item.url);
      if (path) inbound.add(path);
    }
    const columns = [
      ...(Array.isArray(footer?.footer1Columns) ? footer.footer1Columns : []),
      ...(Array.isArray(footer?.footer2Columns) ? footer.footer2Columns : []),
    ];
    for (const column of columns) {
      if (typeof column === 'string') collectPaths(column, inbound);
    }
    for (const row of posts) {
      collectPaths([row.bodyHtml, row.excerpt, faqText(row.faqJson)].filter(Boolean).join('\n'), inbound);
    }
    for (const cat of categories) {
      collectPaths([cat.description, faqText(cat.faqJson)].filter(Boolean).join('\n'), inbound);
    }

    const hubPostIds = new Set(
      posts.filter((row) => row.type === CmsContentType.Post).slice(0, BLOG_HOME_LINKS).map((row) => row.id),
    );
    const orphans: CmsOrphanItem[] = [];
    for (const row of posts) {
      const isPage = row.type === CmsContentType.Page;
      const publicPath = isPage ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug);
      const linked = inbound.has(publicPath) || menus.some((item) => item.objectId === row.id);
      if (isPage) {
        if (linked) continue;
        orphans.push({
          id: row.id,
          kind: 'page',
          title: row.title,
          editPath: `/admin/pages/${row.id}`,
          publicPath,
          reason: 'Không có trong menu, chân trang hoặc nội dung khác.',
        });
        continue;
      }
      if (row.categoryId || hubPostIds.has(row.id) || linked) continue;
      orphans.push({
        id: row.id,
        kind: 'post',
        title: row.title,
        editPath: `/admin/posts/${row.id}`,
        publicPath,
        reason: 'Không có chuyên mục, không nằm trong 24 bài đầu /cam-nang, và không được link nội bộ.',
      });
    }
    return orphans.slice(0, 40);
  }

  private async redirectIssues(): Promise<CmsRedirectIssue[]> {
    const rows = await this.prisma.cmsRedirect.findMany({
      select: { fromPath: true, toPath: true },
      take: 2000,
    });
    const next = new Map<string, string>();
    for (const row of rows) {
      const from = pathOnly(row.fromPath);
      const to = pathOnly(row.toPath);
      if (from && to) next.set(from, to);
    }
    const issues: CmsRedirectIssue[] = [];
    const reported = new Set<string>();
    for (const start of next.keys()) {
      const hops = [start];
      const seen = new Set<string>([start]);
      let cursor = start;
      let loop = false;
      for (let i = 0; i < 8; i += 1) {
        const dest = next.get(cursor);
        if (!dest) break;
        if (seen.has(dest)) {
          hops.push(dest);
          loop = true;
          break;
        }
        hops.push(dest);
        seen.add(dest);
        cursor = dest;
      }
      if (hops.length < 3 && !loop) continue;
      const key = hops.join('>');
      if (reported.has(key)) continue;
      reported.add(key);
      issues.push({ kind: loop ? 'loop' : 'chain', hops });
    }
    return issues.slice(0, 40);
  }
}
