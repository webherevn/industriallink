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
  type CmsBrokenLink,
  type CmsLinkAudit,
  type CmsLinkSuggestion,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

const STOP = new Set([
  'cho', 'cua', 'cac', 'mot', 'nhung', 'duoc', 'trong', 'khong', 'voi', 'nay', 'khi',
  'la', 'va', 'cac', 'den', 'tai', 'tren', 'duoi', 'hoac', 'neu', 'thi', 'ban', 'viec',
  'lam', 'cong', 'ty', 'the', 'and', 'the', 'for', 'with',
]);

const APP_PREFIXES = [
  '/login',
  '/register',
  '/dashboard',
  '/cv',
  '/account',
  '/upload',
  '/applications',
  '/connections',
  '/progress',
  '/recommended',
  '/recruiter',
  '/admin',
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

function pathOnly(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.startsWith('#') || /^mailto:|^tel:|^javascript:/i.test(value)) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host !== 'inlink.vn' && host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.inlink.vn')) {
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
    if (path && path !== '/') into.add(path);
  }
}

function parentPath(path: string): string {
  if (path.startsWith('/cam-nang/')) return '/cam-nang';
  if (path.startsWith('/viec-lam/')) return jobListingPath();
  if (path.startsWith('/tac-gia/')) return '/cam-nang';
  if (path.startsWith('/cong-ty/')) return jobListingPath();
  if (path.startsWith('/trang/')) return '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return `/${parts.slice(0, -1).join('/')}`;
}

function isAppPath(path: string): boolean {
  return APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isAsset(path: string): boolean {
  return /\.(xml|txt|ico|png|jpe?g|webp|gif|svg|css|js|map|woff2?)$/i.test(path);
}

@Injectable()
export class SeoLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestions(query: string, excludeId?: string): Promise<CmsLinkSuggestion[]> {
    const words = new Set(tokens(query).slice(0, 12));
    if (words.size === 0) return [];
    const [posts, categories] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: {
          isDeleted: false,
          status: CmsContentStatus.Published,
          OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          excerpt: true,
          focusKeyword: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 300,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, slug: true, description: true, focusKeyword: true },
        take: 100,
      }),
    ]);
    const scored: Array<CmsLinkSuggestion & { score: number }> = [];
    for (const row of posts) {
      const score = this.overlap(words, row.title, 3) + this.overlap(words, row.focusKeyword, 4) + this.overlap(words, row.excerpt, 1);
      if (score <= 0) continue;
      const kind = row.type === CmsContentType.Page ? 'page' : 'post';
      scored.push({
        id: row.id,
        kind,
        title: row.title,
        publicPath: kind === 'page' ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug),
        anchor: (row.focusKeyword?.trim() || row.title).slice(0, 80),
        score,
      });
    }
    for (const row of categories) {
      const score = this.overlap(words, row.name, 3) + this.overlap(words, row.focusKeyword, 4) + this.overlap(words, row.description, 1);
      if (score <= 0) continue;
      scored.push({
        id: row.id,
        kind: 'category',
        title: row.name,
        publicPath: cmsCategoryPublicPath(row.slug),
        anchor: (row.focusKeyword?.trim() || row.name).slice(0, 80),
        score,
      });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...item }) => item);
  }

  async audit(): Promise<CmsLinkAudit> {
    const known = await this.knownPaths();
    const redirects = await this.prisma.cmsRedirect.findMany({
      select: { fromPath: true },
      take: 2000,
    });
    for (const row of redirects) {
      const path = pathOnly(row.fromPath);
      if (path) known.add(path);
    }
    const broken = await this.brokenInContent(known);
    const unknownHits = await this.unknownHits(known, new Set(broken.map((item) => item.path)));
    return { generatedAt: new Date().toISOString(), broken, unknownHits };
  }

  private overlap(words: Set<string>, text: string | null | undefined, weight: number): number {
    if (!text) return 0;
    let score = 0;
    for (const word of tokens(text)) {
      if (words.has(word)) score += weight;
    }
    return score;
  }

  private async knownPaths(): Promise<Set<string>> {
    const known = new Set<string>(['/', '/cam-nang', jobListingPath()]);
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [posts, categories, authors, jobs] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: live,
        select: { type: true, slug: true },
        take: 2000,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { slug: true },
        take: 300,
      }),
      this.prisma.cmsAuthorProfile.findMany({
        where: { isPublic: true, slug: { not: null } },
        select: { slug: true },
        take: 100,
      }),
      this.prisma.job.findMany({
        where: {
          isDeleted: false,
          status: JobStatus.Published,
          company: { isDeleted: false, status: CompanyStatus.Active },
        },
        select: { id: true, slug: true, company: { select: { id: true, slug: true } } },
        take: 2000,
      }),
    ]);
    for (const row of posts) {
      known.add(row.type === CmsContentType.Page ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug));
    }
    for (const row of categories) known.add(cmsCategoryPublicPath(row.slug));
    for (const row of authors) {
      if (row.slug) known.add(cmsAuthorPublicPath(row.slug));
    }
    for (const row of jobs) {
      known.add(jobPublicPath(row));
      known.add(companyPublicPath({ slug: row.company.slug, id: row.company.id }));
    }
    return known;
  }

  private async brokenInContent(known: Set<string>): Promise<CmsBrokenLink[]> {
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [posts, categories] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: live,
        select: { id: true, type: true, title: true, bodyHtml: true, excerpt: true, faqJson: true },
        take: 300,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, description: true, faqJson: true },
        take: 100,
      }),
    ]);
    const byPath = new Map<string, CmsBrokenLink>();
    const add = (path: string, source: { title: string; editPath: string }) => {
      if (known.has(path) || isAppPath(path) || isAsset(path)) return;
      const current = byPath.get(path) ?? {
        path,
        hits: 0,
        suggestedTo: parentPath(path),
        sources: [],
      };
      if (!current.sources.some((item) => item.editPath === source.editPath)) {
        current.sources.push(source);
      }
      byPath.set(path, current);
    };
    for (const row of posts) {
      const paths = new Set<string>();
      collectPaths([row.bodyHtml, row.excerpt, faqText(row.faqJson)].filter(Boolean).join('\n'), paths);
      const editPath = row.type === CmsContentType.Page ? `/admin/pages/${row.id}` : `/admin/posts/${row.id}`;
      for (const path of paths) add(path, { title: row.title, editPath });
    }
    for (const row of categories) {
      const paths = new Set<string>();
      collectPaths([row.description, faqText(row.faqJson)].filter(Boolean).join('\n'), paths);
      for (const path of paths) add(path, { title: row.name, editPath: '/admin/categories' });
    }
    return [...byPath.values()].slice(0, 40);
  }

  private async unknownHits(known: Set<string>, already: Set<string>): Promise<CmsBrokenLink[]> {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ path: string; n: number }>>`
        SELECT path, count(*)::int AS n
        FROM shared.analytics_hit
        WHERE created_at > now() - interval '14 days'
          AND path NOT LIKE '/admin%'
          AND path NOT LIKE '/api%'
          AND path NOT LIKE '/_next%'
        GROUP BY path
        ORDER BY n DESC
        LIMIT 200
      `;
      return rows
        .map((row) => ({ path: pathOnly(row.path) || '', hits: Number(row.n) || 0 }))
        .filter((row) => row.path && row.path !== '/' && !known.has(row.path) && !isAppPath(row.path) && !isAsset(row.path) && !already.has(row.path))
        .slice(0, 40)
        .map((row) => ({
          path: row.path,
          hits: row.hits,
          suggestedTo: parentPath(row.path),
          sources: [],
        }));
    } catch {
      return [];
    }
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
