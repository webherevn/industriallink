import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  buildCmsRobotsString,
  cmsContentPublicPath,
  nextUniqueSlug,
  toSeoSlug,
  type CmsCategoryView,
  type CmsFaqItem,
  type CmsPostListItem,
  type CmsPostView,
  type CmsRedirectView,
  type ListCmsPostsQuery,
  type UpsertCmsCategoryRequest,
  type UpsertCmsPostRequest,
  type UpsertCmsRedirectRequest,
} from '@industriallink/contracts';
import type { CmsCategory, CmsPost, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';
import { sanitizeCmsHtml } from './sanitize-cms-html';

type PostWithCategory = CmsPost & {
  category: { id: string; name: string; slug: string } | null;
};

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indexing: GoogleIndexingService,
  ) {}

  // ---- Categories ----

  async listCategories(includeDeleted = false): Promise<CmsCategoryView[]> {
    const rows = await this.prisma.cmsCategory.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.mapCategory(r));
  }

  async createCategory(
    user: AuthenticatedUser,
    input: UpsertCmsCategoryRequest,
  ): Promise<CmsCategoryView> {
    const base = toSeoSlug(input.slug || input.name);
    const taken = await this.prisma.cmsCategory.findMany({
      where: { isDeleted: false },
      select: { slug: true },
    });
    const slug = nextUniqueSlug(
      base,
      taken.map((t) => t.slug),
    );
    const row = await this.prisma.cmsCategory.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        ogImageUrl: input.ogImageUrl ?? null,
        robots: input.robots?.trim() || 'index,follow',
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    return this.mapCategory(row);
  }

  async updateCategory(
    user: AuthenticatedUser,
    id: string,
    input: UpsertCmsCategoryRequest,
  ): Promise<CmsCategoryView> {
    const existing = await this.prisma.cmsCategory.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy danh mục');

    let slug = existing.slug;
    if (input.slug || input.name) {
      const base = toSeoSlug(input.slug || input.name || existing.name);
      if (base !== existing.slug) {
        const taken = await this.prisma.cmsCategory.findMany({
          where: { isDeleted: false, id: { not: id } },
          select: { slug: true },
        });
        slug = nextUniqueSlug(
          base,
          taken.map((t) => t.slug),
        );
      }
    }

    const row = await this.prisma.cmsCategory.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? existing.name,
        slug,
        description: input.description !== undefined ? input.description : existing.description,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : existing.seoTitle,
        seoDescription:
          input.seoDescription !== undefined ? input.seoDescription : existing.seoDescription,
        ogImageUrl: input.ogImageUrl !== undefined ? input.ogImageUrl : existing.ogImageUrl,
        robots: input.robots?.trim() || existing.robots,
        updatedBy: user.id,
        version: { increment: 1 },
      },
    });
    return this.mapCategory(row);
  }

  async deleteCategory(user: AuthenticatedUser, id: string): Promise<{ message: string }> {
    const existing = await this.prisma.cmsCategory.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy danh mục');
    await this.prisma.cmsCategory.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
        updatedBy: user.id,
        version: { increment: 1 },
      },
    });
    return { message: 'Đã xoá danh mục' };
  }

  // ---- Posts / Pages ----

  async listPostsAdmin(query: ListCmsPostsQuery = {}): Promise<CmsPostListItem[]> {
    const rows = await this.prisma.cmsPost.findMany({
      where: {
        isDeleted: false,
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: { slug: query.category, isDeleted: false } } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.min(query.limit ?? 100, 200),
    });
    return rows.map((r) => this.mapPostList(r));
  }

  async listPublished(query: ListCmsPostsQuery = {}): Promise<CmsPostListItem[]> {
    const rows = await this.prisma.cmsPost.findMany({
      where: {
        isDeleted: false,
        status: CmsContentStatus.Published,
        type: query.type ?? CmsContentType.Post,
        robotsIndex: true,
        ...(query.category ? { category: { slug: query.category, isDeleted: false } } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(query.limit ?? 50, 200),
    });
    return rows.map((r) => this.mapPostList(r));
  }

  async getPostAdmin(id: string): Promise<CmsPostView> {
    const row = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: false },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!row) throw new NotFoundException('Không tìm thấy nội dung');
    return this.mapPost(row);
  }

  async getPublishedBySlug(type: CmsContentType, slug: string): Promise<CmsPostView | null> {
    const row = await this.prisma.cmsPost.findFirst({
      where: {
        type,
        slug,
        isDeleted: false,
        status: CmsContentStatus.Published,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return row ? this.mapPost(row) : null;
  }

  async createPost(user: AuthenticatedUser, input: UpsertCmsPostRequest): Promise<CmsPostView> {
    this.assertPostInput(input);
    const type = input.type;
    const base = toSeoSlug(input.slug || input.title);
    const slug = await this.uniquePostSlug(type, base);
    const publish = Boolean(input.publish);
    const robots = this.resolveRobots(input);
    const row = await this.prisma.cmsPost.create({
      data: {
        type,
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt ?? null,
        bodyHtml: sanitizeCmsHtml(input.bodyHtml ?? ''),
        status: publish ? CmsContentStatus.Published : CmsContentStatus.Draft,
        publishedAt: publish ? new Date() : null,
        categoryId: type === CmsContentType.Page ? null : (input.categoryId ?? null),
        authorId: user.id,
        authorName: input.authorName ?? user.displayName,
        authorTitle: input.authorTitle ?? null,
        authorBio: input.authorBio ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        canonicalPath: input.canonicalPath ?? null,
        ogTitle: input.ogTitle ?? null,
        ogDescription: input.ogDescription ?? null,
        ogImageUrl: input.ogImageUrl ?? null,
        robotsIndex: robots.index,
        robotsFollow: robots.follow,
        robotsMaxImagePreview: input.robotsMaxImagePreview ?? true,
        robots: buildCmsRobotsString(robots.index, robots.follow),
        faqJson: this.normalizeFaq(input.faq) as unknown as Prisma.InputJsonValue,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (publish && robots.index) {
      void this.indexing.publish(
        this.absolutePublicUrl(type, slug),
        'URL_UPDATED',
      );
    }
    return this.mapPost(row);
  }

  async updatePost(
    user: AuthenticatedUser,
    id: string,
    input: UpsertCmsPostRequest,
  ): Promise<CmsPostView> {
    const existing = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nội dung');

    const type = (input.type ?? existing.type) as CmsContentType;
    let slug = existing.slug;
    if (input.slug || input.title) {
      const base = toSeoSlug(input.slug || input.title || existing.title);
      if (base !== existing.slug || type !== existing.type) {
        slug = await this.uniquePostSlug(type, base, id);
      }
    }

    if (slug !== existing.slug) {
      const fromPath = cmsContentPublicPath(existing.type as CmsContentType, existing.slug);
      const toPath = cmsContentPublicPath(type, slug);
      await this.upsertRedirectRecord(user, {
        fromPath,
        toPath,
        statusCode: 301,
        note: `Đổi slug ${existing.type}`,
      });
    }

    let status = existing.status;
    let publishedAt = existing.publishedAt;
    if (input.publish === true) {
      status = CmsContentStatus.Published;
      publishedAt = publishedAt ?? new Date();
    } else if (input.publish === false) {
      status = CmsContentStatus.Draft;
    }

    const robots = this.resolveRobots(input, existing);

    const row = await this.prisma.cmsPost.update({
      where: { id },
      data: {
        type,
        title: input.title?.trim() ?? existing.title,
        slug,
        excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
        bodyHtml:
          input.bodyHtml !== undefined
            ? sanitizeCmsHtml(input.bodyHtml)
            : existing.bodyHtml,
        status,
        publishedAt,
        categoryId:
          type === CmsContentType.Page
            ? null
            : input.categoryId !== undefined
              ? input.categoryId
              : existing.categoryId,
        coverImageUrl:
          input.coverImageUrl !== undefined ? input.coverImageUrl : existing.coverImageUrl,
        authorName: input.authorName !== undefined ? input.authorName : existing.authorName,
        authorTitle: input.authorTitle !== undefined ? input.authorTitle : existing.authorTitle,
        authorBio: input.authorBio !== undefined ? input.authorBio : existing.authorBio,
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : existing.seoTitle,
        seoDescription:
          input.seoDescription !== undefined ? input.seoDescription : existing.seoDescription,
        canonicalPath:
          input.canonicalPath !== undefined ? input.canonicalPath : existing.canonicalPath,
        ogTitle: input.ogTitle !== undefined ? input.ogTitle : existing.ogTitle,
        ogDescription:
          input.ogDescription !== undefined ? input.ogDescription : existing.ogDescription,
        ogImageUrl: input.ogImageUrl !== undefined ? input.ogImageUrl : existing.ogImageUrl,
        robotsIndex: robots.index,
        robotsFollow: robots.follow,
        robotsMaxImagePreview:
          input.robotsMaxImagePreview !== undefined
            ? input.robotsMaxImagePreview
            : existing.robotsMaxImagePreview,
        robots: buildCmsRobotsString(robots.index, robots.follow),
        faqJson:
          input.faq !== undefined
            ? (this.normalizeFaq(input.faq) as unknown as Prisma.InputJsonValue)
            : undefined,
        updatedBy: user.id,
        version: { increment: 1 },
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    const wasPublished = existing.status === CmsContentStatus.Published;
    const isPublished = status === CmsContentStatus.Published;
    const publicUrl = this.absolutePublicUrl(type, slug);
    if (isPublished && robots.index) {
      void this.indexing.publish(publicUrl, 'URL_UPDATED');
    } else if (wasPublished && (!isPublished || !robots.index)) {
      void this.indexing.publish(
        this.absolutePublicUrl(existing.type as CmsContentType, existing.slug),
        'URL_DELETED',
      );
    }

    return this.mapPost(row);
  }

  async setPostStatus(
    user: AuthenticatedUser,
    id: string,
    status: CmsContentStatus,
  ): Promise<CmsPostView> {
    const existing = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nội dung');
    const row = await this.prisma.cmsPost.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === CmsContentStatus.Published
            ? (existing.publishedAt ?? new Date())
            : existing.publishedAt,
        updatedBy: user.id,
        version: { increment: 1 },
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    const url = this.absolutePublicUrl(row.type as CmsContentType, row.slug);
    if (status === CmsContentStatus.Published && row.robotsIndex) {
      void this.indexing.publish(url, 'URL_UPDATED');
    } else if (existing.status === CmsContentStatus.Published) {
      void this.indexing.publish(url, 'URL_DELETED');
    }
    return this.mapPost(row);
  }

  async deletePost(user: AuthenticatedUser, id: string): Promise<{ message: string }> {
    const existing = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy nội dung');
    await this.prisma.cmsPost.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
        updatedBy: user.id,
        version: { increment: 1 },
      },
    });
    if (existing.status === CmsContentStatus.Published) {
      void this.indexing.publish(
        this.absolutePublicUrl(existing.type as CmsContentType, existing.slug),
        'URL_DELETED',
      );
    }
    return { message: 'Đã xoá nội dung' };
  }

  async seoOverview(): Promise<{
    categories: number;
    posts: number;
    pages: number;
    publishedPosts: number;
    publishedPages: number;
    drafts: number;
    redirects: number;
  }> {
    const [categories, posts, pages, publishedPosts, publishedPages, drafts, redirects] =
      await Promise.all([
        this.prisma.cmsCategory.count({ where: { isDeleted: false } }),
        this.prisma.cmsPost.count({ where: { isDeleted: false, type: CmsContentType.Post } }),
        this.prisma.cmsPost.count({ where: { isDeleted: false, type: CmsContentType.Page } }),
        this.prisma.cmsPost.count({
          where: {
            isDeleted: false,
            type: CmsContentType.Post,
            status: CmsContentStatus.Published,
          },
        }),
        this.prisma.cmsPost.count({
          where: {
            isDeleted: false,
            type: CmsContentType.Page,
            status: CmsContentStatus.Published,
          },
        }),
        this.prisma.cmsPost.count({
          where: { isDeleted: false, status: CmsContentStatus.Draft },
        }),
        this.prisma.cmsRedirect.count(),
      ]);
    return { categories, posts, pages, publishedPosts, publishedPages, drafts, redirects };
  }

  // ---- Redirects ----

  async listRedirects(): Promise<CmsRedirectView[]> {
    const rows = await this.prisma.cmsRedirect.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      fromPath: r.fromPath,
      toPath: r.toPath,
      statusCode: r.statusCode,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async resolveRedirect(fromPath: string): Promise<CmsRedirectView | null> {
    const path = fromPath.startsWith('/') ? fromPath : `/${fromPath}`;
    const row = await this.prisma.cmsRedirect.findUnique({ where: { fromPath: path } });
    if (!row) return null;
    return {
      id: row.id,
      fromPath: row.fromPath,
      toPath: row.toPath,
      statusCode: row.statusCode,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsertRedirect(
    user: AuthenticatedUser,
    input: UpsertCmsRedirectRequest,
  ): Promise<CmsRedirectView> {
    return this.upsertRedirectRecord(user, input);
  }

  async deleteRedirect(id: string): Promise<{ message: string }> {
    await this.prisma.cmsRedirect.delete({ where: { id } });
    return { message: 'Đã xoá redirect' };
  }

  private async upsertRedirectRecord(
    user: AuthenticatedUser,
    input: UpsertCmsRedirectRequest,
  ): Promise<CmsRedirectView> {
    const fromPath = this.normalizePath(input.fromPath);
    const toPath = this.normalizePath(input.toPath);
    if (fromPath === toPath) {
      throw new BadRequestException('fromPath và toPath không được trùng');
    }
    const row = await this.prisma.cmsRedirect.upsert({
      where: { fromPath },
      create: {
        fromPath,
        toPath,
        statusCode: input.statusCode ?? 301,
        note: input.note ?? null,
        createdBy: user.id,
      },
      update: {
        toPath,
        statusCode: input.statusCode ?? 301,
        note: input.note ?? null,
      },
    });
    return {
      id: row.id,
      fromPath: row.fromPath,
      toPath: row.toPath,
      statusCode: row.statusCode,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private normalizePath(path: string): string {
    const p = path.trim();
    if (!p.startsWith('/')) return `/${p}`;
    return p.split('?')[0] || '/';
  }

  private absolutePublicUrl(type: CmsContentType, slug: string): string {
    const base = (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${base}${cmsContentPublicPath(type, slug)}`;
  }

  private resolveRobots(
    input: UpsertCmsPostRequest,
    existing?: CmsPost,
  ): { index: boolean; follow: boolean } {
    if (input.robotsIndex !== undefined || input.robotsFollow !== undefined) {
      return {
        index: input.robotsIndex ?? existing?.robotsIndex ?? true,
        follow: input.robotsFollow ?? existing?.robotsFollow ?? true,
      };
    }
    if (input.robots) {
      return {
        index: !input.robots.includes('noindex'),
        follow: !input.robots.includes('nofollow'),
      };
    }
    return {
      index: existing?.robotsIndex ?? true,
      follow: existing?.robotsFollow ?? true,
    };
  }

  private normalizeFaq(faq?: CmsFaqItem[] | null): CmsFaqItem[] {
    if (!faq?.length) return [];
    return faq
      .map((f) => ({
        question: (f.question || '').trim(),
        answer: (f.answer || '').trim(),
      }))
      .filter((f) => f.question && f.answer)
      .slice(0, 30);
  }

  private parseFaq(json: Prisma.JsonValue | null): CmsFaqItem[] {
    if (!json || !Array.isArray(json)) return [];
    return json
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        const question = typeof o.question === 'string' ? o.question : '';
        const answer = typeof o.answer === 'string' ? o.answer : '';
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((x): x is CmsFaqItem => Boolean(x));
  }

  private assertPostInput(input: UpsertCmsPostRequest): void {
    if (!input.title?.trim()) throw new BadRequestException('Thiếu tiêu đề');
  }

  private async uniquePostSlug(
    type: CmsContentType,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const taken = await this.prisma.cmsPost.findMany({
      where: {
        type,
        isDeleted: false,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { slug: true },
    });
    return nextUniqueSlug(
      base,
      taken.map((t) => t.slug),
    );
  }

  private mapCategory(row: CmsCategory): CmsCategoryView {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sortOrder,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImageUrl: row.ogImageUrl,
      robots: row.robots,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPostList(row: PostWithCategory): CmsPostListItem {
    return {
      id: row.id,
      type: row.type as CmsContentType,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      status: row.status as CmsContentStatus,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      coverImageUrl: row.coverImageUrl,
      seoTitle: row.seoTitle,
      robotsIndex: row.robotsIndex,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPost(row: PostWithCategory): CmsPostView {
    return {
      ...this.mapPostList(row),
      bodyHtml: row.bodyHtml,
      authorId: row.authorId,
      authorName: row.authorName,
      authorTitle: row.authorTitle,
      authorBio: row.authorBio,
      seoDescription: row.seoDescription,
      canonicalPath: row.canonicalPath,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImageUrl: row.ogImageUrl,
      robots: row.robots,
      robotsFollow: row.robotsFollow,
      robotsMaxImagePreview: row.robotsMaxImagePreview,
      faq: this.parseFaq(row.faqJson),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
