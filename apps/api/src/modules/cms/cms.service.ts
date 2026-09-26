import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  CmsMenuLocation,
  buildCmsRobotsString,
  buildDefaultRobotsTxt,
  cmsAuthorPublicPath,
  cmsCategoryPublicPath,
  cmsContentPublicPath,
  cmsPagePublicPath,
  cmsPostPublicPath,
  nextUniqueSlug,
  toSeoSlug,
  type CmsAuthorProfileView,
  type CmsAuthorSocial,
  type CmsCategoryView,
  type CmsFaqItem,
  type CmsFooterBlock,
  type CmsFooterSettingsView,
  type CmsHomepageSettingsView,
  type CmsRobotsSettingsView,
  type CmsSiteCodeSettingsView,
  type CmsMenuItemView,
  type CmsMenuView,
  type CmsPostListItem,
  type CmsPostView,
  type CmsRedirectView,
  type CmsSeoIssueItem,
  type CmsSeoOverview,
  type ListCmsPostsQuery,
  type CmsPostListPage,
  type SaveCmsMenuRequest,
  type AssignCmsAuthorProfileRequest,
  type UpsertCmsAuthorProfileRequest,
  type UpsertCmsCategoryRequest,
  type UpsertCmsFooterSettingsRequest,
  type UpsertCmsHomepageSettingsRequest,
  type UpsertCmsRobotsSettingsRequest,
  type UpsertCmsSiteCodeSettingsRequest,
  type UpsertCmsPostRequest,
  type UpsertCmsRedirectRequest,
} from '@industriallink/contracts';
import type { CmsAuthorProfile, CmsCategory, CmsPost, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
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
    const robots = this.resolveCategoryRobots(input);
    const descriptionHtml = this.normalizeCategoryDescription(input.description);
    const row = await this.prisma.cmsCategory.create({
      data: {
        name: input.name.trim(),
        slug,
        description: descriptionHtml,
        sortOrder: input.sortOrder ?? 0,
        avatarUrl: input.avatarUrl ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        focusKeyword: input.focusKeyword?.trim() || null,
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

    const robots = this.resolveCategoryRobots(input, existing);
    const row = await this.prisma.cmsCategory.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? existing.name,
        slug,
        description:
          input.description !== undefined
            ? this.normalizeCategoryDescription(input.description)
            : existing.description,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : existing.seoTitle,
        seoDescription:
          input.seoDescription !== undefined ? input.seoDescription : existing.seoDescription,
        focusKeyword:
          input.focusKeyword !== undefined
            ? input.focusKeyword?.trim() || null
            : existing.focusKeyword,
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
        isDeleted: Boolean(query.trashed),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status && !query.trashed ? { status: query.status } : {}),
        ...(query.category ? { category: { slug: query.category, isDeleted: false } } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.min(query.limit ?? 100, 200),
    });
    return rows.map((r) => this.mapPostList(r));
  }

  async listPublished(query: ListCmsPostsQuery = {}): Promise<CmsPostListPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(query.limit ?? 12, 1), 200);
    let authorUserId: string | undefined;
    if (query.author) {
      const author = await this.prisma.cmsAuthorProfile.findFirst({
        where: { slug: query.author, isPublic: true },
        select: { userId: true },
      });
      if (!author) {
        return { items: [], total: 0, page, pageSize, totalPages: 1 };
      }
      authorUserId = author.userId;
    }
    const rawType = (query.type ?? CmsContentType.Post) as string;
    const type =
      String(rawType).toLowerCase() === CmsContentType.Page
        ? CmsContentType.Page
        : CmsContentType.Post;
    const where = this.livePostWhere({
      type,
      robotsIndex: true,
      ...(query.category ? { category: { slug: query.category, isDeleted: false } } : {}),
      ...(authorUserId ? { authorId: authorUserId } : {}),
    });
    const [total, rows] = await Promise.all([
      this.prisma.cmsPost.count({ where }),
      this.prisma.cmsPost.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map((r) => this.mapPostList(r)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getPostAdmin(id: string): Promise<CmsPostView> {
    const row = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: false },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (!row) throw new NotFoundException('Không tìm thấy nội dung');
    return this.mapPostView(row);
  }

  async getPublishedBySlug(type: CmsContentType, slug: string): Promise<CmsPostView | null> {
    const row = await this.prisma.cmsPost.findFirst({
      where: this.livePostWhere({ type, slug }),
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return row ? this.mapPostView(row) : null;
  }

  async createPost(user: AuthenticatedUser, input: UpsertCmsPostRequest): Promise<CmsPostView> {
    this.assertPostInput(input);
    const type = input.type;
    const base = toSeoSlug(input.slug || input.title);
    const slug = await this.uniquePostSlug(type, base);
    const publish = Boolean(input.publish);
    const robots = this.resolveRobots(input);
    const publishedAt = this.resolvePublishedAt(input.publishedAt, publish, null);
    const author = await this.ensureAuthorProfile(user);
    const row = await this.prisma.cmsPost.create({
      data: {
        type,
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt ?? null,
        bodyHtml: sanitizeCmsHtml(input.bodyHtml ?? ''),
        status: publish ? CmsContentStatus.Published : CmsContentStatus.Draft,
        publishedAt,
        categoryId: type === CmsContentType.Page ? null : (input.categoryId ?? null),
        authorId: user.id,
        authorName: author.displayName,
        authorTitle: author.title,
        authorBio: author.bio,
        coverImageUrl: input.coverImageUrl ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        focusKeyword: input.focusKeyword?.trim() || null,
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
    if (
      publish &&
      robots.index &&
      this.isPubliclyLive(CmsContentStatus.Published, publishedAt)
    ) {
      void this.indexing.publish(
        this.absolutePublicUrl(type, slug),
        'URL_UPDATED',
      );
    }
    return this.mapPostView(row);
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
    if (input.publishedAt !== undefined) {
      publishedAt = this.parseOptionalDate(input.publishedAt);
    }
    if (input.publish === true) {
      status = CmsContentStatus.Published;
      publishedAt = publishedAt ?? new Date();
    } else if (input.publish === false) {
      status = CmsContentStatus.Draft;
    }

    const robots = this.resolveRobots(input, existing);
    const authorSnap = await this.resolveAuthorSnapshot(existing.authorId);

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
        // Tác giả = tài khoản tạo bài; snapshot lấy từ hồ sơ tác giả (không sửa tay trên post)
        authorName: authorSnap.displayName,
        authorTitle: authorSnap.title,
        authorBio: authorSnap.bio,
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : existing.seoTitle,
        seoDescription:
          input.seoDescription !== undefined ? input.seoDescription : existing.seoDescription,
        focusKeyword:
          input.focusKeyword !== undefined
            ? input.focusKeyword?.trim() || null
            : existing.focusKeyword,
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

    const wasLive = this.isPubliclyLive(existing.status, existing.publishedAt);
    const isLive = this.isPubliclyLive(status, publishedAt);
    const publicUrl = this.absolutePublicUrl(type, slug);
    if (isLive && robots.index) {
      void this.indexing.publish(publicUrl, 'URL_UPDATED');
    } else if (wasLive && (!isLive || !robots.index)) {
      void this.indexing.publish(
        this.absolutePublicUrl(existing.type as CmsContentType, existing.slug),
        'URL_DELETED',
      );
    }

    return this.mapPostView(row);
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
    const nowLive = this.isPubliclyLive(row.status, row.publishedAt);
    if (nowLive && row.robotsIndex) {
      void this.indexing.publish(url, 'URL_UPDATED');
    } else if (this.isPubliclyLive(existing.status, existing.publishedAt)) {
      void this.indexing.publish(url, 'URL_DELETED');
    }
    return this.mapPostView(row);
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
    if (this.isPubliclyLive(existing.status, existing.publishedAt)) {
      void this.indexing.publish(
        this.absolutePublicUrl(existing.type as CmsContentType, existing.slug),
        'URL_DELETED',
      );
    }
    return { message: 'Đã chuyển vào thùng rác' };
  }

  async restorePost(user: AuthenticatedUser, id: string): Promise<CmsPostView> {
    const existing = await this.prisma.cmsPost.findFirst({
      where: { id, isDeleted: true },
    });
    if (!existing) throw new NotFoundException('Không có trong thùng rác');
    const row = await this.prisma.cmsPost.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedBy: user.id,
        version: { increment: 1 },
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    if (this.isPubliclyLive(row.status, row.publishedAt) && row.robotsIndex) {
      void this.indexing.publish(
        this.absolutePublicUrl(row.type as CmsContentType, row.slug),
        'URL_UPDATED',
      );
    }
    return this.mapPostView(row);
  }

  async seoOverview(): Promise<CmsSeoOverview> {
    const siteUrl = (
      process.env.PUBLIC_SITE_URL ||
      process.env.WEB_ORIGIN ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    const [
      categories,
      posts,
      pages,
      publishedPosts,
      publishedPages,
      drafts,
      archived,
      redirects,
      publicAuthors,
      noindexPublished,
      publishedRows,
      categoryRows,
      authorRows,
    ] = await Promise.all([
      this.prisma.cmsCategory.count({ where: { isDeleted: false } }),
      this.prisma.cmsPost.count({ where: { isDeleted: false, type: CmsContentType.Post } }),
      this.prisma.cmsPost.count({ where: { isDeleted: false, type: CmsContentType.Page } }),
      this.prisma.cmsPost.count({
        where: this.livePostWhere({ type: CmsContentType.Post }),
      }),
      this.prisma.cmsPost.count({
        where: this.livePostWhere({ type: CmsContentType.Page }),
      }),
      this.prisma.cmsPost.count({
        where: { isDeleted: false, status: CmsContentStatus.Draft },
      }),
      this.prisma.cmsPost.count({
        where: { isDeleted: false, status: CmsContentStatus.Archived },
      }),
      this.prisma.cmsRedirect.count(),
      this.prisma.cmsAuthorProfile.count({
        where: { isPublic: true, slug: { not: null } },
      }),
      this.prisma.cmsPost.count({
        where: this.livePostWhere({ robotsIndex: false }),
      }),
      this.prisma.cmsPost.findMany({
        where: this.livePostWhere(),
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          excerpt: true,
          bodyHtml: true,
          categoryId: true,
          publishedAt: true,
          updatedAt: true,
          coverImageUrl: true,
          seoTitle: true,
          seoDescription: true,
          focusKeyword: true,
          ogImageUrl: true,
          ogTitle: true,
          robotsIndex: true,
          faqJson: true,
          authorId: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 300,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
          focusKeyword: true,
          ogImageUrl: true,
          avatarUrl: true,
          robotsIndex: true,
          updatedAt: true,
        },
        take: 200,
      }),
      this.prisma.cmsAuthorProfile.findMany({
        where: { isPublic: true },
        select: {
          userId: true,
          displayName: true,
          slug: true,
          title: true,
          bio: true,
          avatarUrl: true,
          worksFor: true,
          linkedinUrl: true,
          updatedAt: true,
        },
        take: 100,
      }),
    ]);

    type IssueBucket = {
      code: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      items: CmsSeoIssueItem[];
    };

    const buckets: Record<string, IssueBucket> = {
      missing_seo_title: {
        code: 'missing_seo_title',
        severity: 'critical',
        title: 'Thiếu SEO title',
        description: 'Nội dung đã xuất bản chưa có tiêu đề SEO riêng.',
        items: [],
      },
      missing_meta_desc: {
        code: 'missing_meta_desc',
        severity: 'critical',
        title: 'Thiếu meta description',
        description: 'Không có SEO description và không có excerpt để fallback.',
        items: [],
      },
      missing_focus_kw: {
        code: 'missing_focus_kw',
        severity: 'warning',
        title: 'Thiếu focus keyword',
        description: 'Chưa gắn từ khóa trọng tâm — khó đo lường & tối ưu on-page.',
        items: [],
      },
      missing_og_image: {
        code: 'missing_og_image',
        severity: 'warning',
        title: 'Thiếu ảnh chia sẻ (OG / cover)',
        description: 'Không có OG image và không có ảnh cover — preview mạng xã hội yếu.',
        items: [],
      },
      noindex_live: {
        code: 'noindex_live',
        severity: 'warning',
        title: 'Published nhưng noindex',
        description: 'Đã xuất bản nhưng robots noindex — Google sẽ không lập chỉ mục.',
        items: [],
      },
      missing_category: {
        code: 'missing_category',
        severity: 'warning',
        title: 'Bài viết chưa gán chuyên mục',
        description: 'Post không thuộc chuyên mục — mất tín hiệu silo & breadcrumb.',
        items: [],
      },
      thin_content: {
        code: 'thin_content',
        severity: 'warning',
        title: 'Nội dung mỏng',
        description: 'Body dưới ~300 từ — rủi ro thin content với Google.',
        items: [],
      },
      cat_missing_seo: {
        code: 'cat_missing_seo',
        severity: 'info',
        title: 'Chuyên mục thiếu SEO',
        description: 'Danh mục chưa có SEO title hoặc mô tả.',
        items: [],
      },
      author_incomplete: {
        code: 'author_incomplete',
        severity: 'info',
        title: 'Hồ sơ tác giả chưa đủ E-E-A-T',
        description: 'Thiếu chức danh, bio, avatar hoặc LinkedIn trên hồ sơ public.',
        items: [],
      },
      duplicate_keyword: {
        code: 'duplicate_keyword',
        severity: 'info',
        title: 'Focus keyword trùng',
        description: 'Nhiều bài dùng cùng một focus keyword — dễ cạnh tranh nội bộ.',
        items: [],
      },
    };

    const pushIssue = (code: keyof typeof buckets, item: CmsSeoIssueItem) => {
      buckets[code].items.push(item);
    };

    const wordApprox = (html?: string | null) => {
      const t = (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!t) return 0;
      return t.split(/\s+/).filter(Boolean).length;
    };

    const keywordMap = new Map<string, typeof publishedRows>();

    let withSeoTitle = 0;
    let withMetaDesc = 0;
    let withFocusKw = 0;
    let withOg = 0;
    let withFaq = 0;
    let withCategory = 0;
    let indexablePublished = 0;

    for (const row of publishedRows) {
      const kind = row.type === CmsContentType.Page ? 'page' : 'post';
      const editPath =
        kind === 'page' ? `/admin/pages/${row.id}` : `/admin/posts/${row.id}`;
      const publicPath =
        kind === 'page' ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug);
      const baseItem = {
        id: row.id,
        kind: kind as 'post' | 'page',
        title: row.title,
        slug: row.slug,
        editPath,
        publicPath,
        status: row.robotsIndex ? 'index' : 'noindex',
        updatedAt: row.updatedAt.toISOString(),
      };

      if (row.robotsIndex) indexablePublished += 1;

      const hasTitle = Boolean(row.seoTitle?.trim());
      const hasDesc = Boolean(row.seoDescription?.trim() || row.excerpt?.trim());
      const hasKw = Boolean(row.focusKeyword?.trim());
      const hasOg = Boolean(row.ogImageUrl?.trim() || row.coverImageUrl?.trim());
      const hasFaq = Array.isArray(row.faqJson)
        ? (row.faqJson as unknown[]).length > 0
        : Boolean(row.faqJson);

      if (hasTitle) withSeoTitle += 1;
      else pushIssue('missing_seo_title', baseItem);

      if (hasDesc) withMetaDesc += 1;
      else pushIssue('missing_meta_desc', baseItem);

      if (hasKw) {
        withFocusKw += 1;
        const key = row.focusKeyword!.trim().toLowerCase();
        const list = keywordMap.get(key) || [];
        list.push(row);
        keywordMap.set(key, list);
      } else pushIssue('missing_focus_kw', baseItem);

      if (hasOg) withOg += 1;
      else pushIssue('missing_og_image', baseItem);

      if (hasFaq) withFaq += 1;

      if (kind === 'post') {
        if (row.categoryId) withCategory += 1;
        else pushIssue('missing_category', baseItem);
      }

      if (!row.robotsIndex) pushIssue('noindex_live', baseItem);

      if (wordApprox(row.bodyHtml) < 300) pushIssue('thin_content', baseItem);
    }

    for (const cat of categoryRows) {
      const item = {
        id: cat.id,
        kind: 'category' as const,
        title: cat.name,
        slug: cat.slug,
        editPath: '/admin/categories',
        publicPath: cmsCategoryPublicPath(cat.slug),
        status: cat.robotsIndex ? 'index' : 'noindex',
        updatedAt: cat.updatedAt.toISOString(),
      };
      if (!cat.seoTitle?.trim() || !(cat.seoDescription?.trim() || cat.description?.trim())) {
        pushIssue('cat_missing_seo', item);
      }
    }

    for (const a of authorRows) {
      const incomplete =
        !a.title?.trim() ||
        !a.bio?.trim() ||
        !a.avatarUrl?.trim() ||
        !a.linkedinUrl?.trim() ||
        !a.slug;
      if (incomplete) {
        pushIssue('author_incomplete', {
          id: a.userId,
          kind: 'author',
          title: a.displayName,
          slug: a.slug || '',
          editPath: '/admin/author',
          publicPath: a.slug ? cmsAuthorPublicPath(a.slug) : null,
          status: null,
          updatedAt: a.updatedAt.toISOString(),
        });
      }
    }

    const topKeywords: Array<{ keyword: string; count: number }> = [];
    for (const [keyword, rows] of keywordMap) {
      topKeywords.push({ keyword, count: rows.length });
      if (rows.length >= 2) {
        for (const row of rows.slice(0, 8)) {
          const kind = row.type === CmsContentType.Page ? 'page' : 'post';
          pushIssue('duplicate_keyword', {
            id: `${row.id}:${keyword}`,
            kind,
            title: `${row.title} · “${keyword}”`,
            slug: row.slug,
            editPath: kind === 'page' ? `/admin/pages/${row.id}` : `/admin/posts/${row.id}`,
            publicPath:
              kind === 'page' ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug),
            status: `${rows.length} bài`,
            updatedAt: row.updatedAt.toISOString(),
          });
        }
      }
    }
    topKeywords.sort((a, b) => b.count - a.count);

    const coveragePct = (done: number, total: number) =>
      total <= 0 ? 100 : Math.round((done / total) * 100);

    const coverage: CmsSeoOverview['coverage'] = [
      {
        id: 'seo_title',
        label: 'SEO title',
        done: withSeoTitle,
        total: publishedRows.length,
        percent: coveragePct(withSeoTitle, publishedRows.length),
        hint: 'Tiêu đề hiển thị trên SERP',
      },
      {
        id: 'meta_desc',
        label: 'Meta description',
        done: withMetaDesc,
        total: publishedRows.length,
        percent: coveragePct(withMetaDesc, publishedRows.length),
        hint: 'Mô tả snippet Google',
      },
      {
        id: 'focus_kw',
        label: 'Focus keyword',
        done: withFocusKw,
        total: publishedRows.length,
        percent: coveragePct(withFocusKw, publishedRows.length),
        hint: 'Từ khóa trọng tâm on-page',
      },
      {
        id: 'og_image',
        label: 'OG / Cover image',
        done: withOg,
        total: publishedRows.length,
        percent: coveragePct(withOg, publishedRows.length),
        hint: 'Ảnh chia sẻ MXH & Discover',
      },
      {
        id: 'category',
        label: 'Gán chuyên mục',
        done: withCategory,
        total: publishedRows.filter((r) => r.type === CmsContentType.Post).length,
        percent: coveragePct(
          withCategory,
          publishedRows.filter((r) => r.type === CmsContentType.Post).length,
        ),
        hint: 'Silo nội dung & breadcrumb',
      },
      {
        id: 'faq',
        label: 'FAQ schema',
        done: withFaq,
        total: publishedRows.length,
        percent: coveragePct(withFaq, publishedRows.length),
        hint: 'Rich result câu hỏi thường gặp',
      },
      {
        id: 'indexable',
        label: 'Indexable',
        done: indexablePublished,
        total: publishedRows.length,
        percent: coveragePct(indexablePublished, publishedRows.length),
        hint: 'Published + robots index',
      },
    ];

    // Health: trung bình có trọng số các coverage chính + phạt critical
    const weighted =
      coverage.find((c) => c.id === 'seo_title')!.percent * 0.22 +
      coverage.find((c) => c.id === 'meta_desc')!.percent * 0.22 +
      coverage.find((c) => c.id === 'focus_kw')!.percent * 0.14 +
      coverage.find((c) => c.id === 'og_image')!.percent * 0.14 +
      coverage.find((c) => c.id === 'category')!.percent * 0.1 +
      coverage.find((c) => c.id === 'indexable')!.percent * 0.18;
    const criticalCount = buckets.missing_seo_title.items.length + buckets.missing_meta_desc.items.length;
    const penalty = Math.min(25, criticalCount * 2 + buckets.noindex_live.items.length);
    const healthScore = Math.max(0, Math.min(100, Math.round(weighted - penalty)));
    const healthGrade =
      healthScore >= 85 ? 'great' : healthScore >= 70 ? 'good' : healthScore >= 50 ? 'ok' : 'bad';

    const issues = Object.values(buckets)
      .map((b) => ({
        code: b.code,
        severity: b.severity,
        title: b.title,
        description: b.description,
        count: b.items.length,
        items: b.items.slice(0, 12),
      }))
      .filter((b) => b.count > 0)
      .sort((a, b) => {
        const rank = { critical: 0, warning: 1, info: 2 };
        return rank[a.severity] - rank[b.severity] || b.count - a.count;
      });

    const recentPublished = publishedRows.slice(0, 8).map((row) => {
      const kind = row.type === CmsContentType.Page ? ('page' as const) : ('post' as const);
      return {
        id: row.id,
        kind,
        title: row.title,
        slug: row.slug,
        editPath: kind === 'page' ? `/admin/pages/${row.id}` : `/admin/posts/${row.id}`,
        publicPath:
          kind === 'page' ? cmsPagePublicPath(row.slug) : cmsPostPublicPath(row.slug),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        hasSeoTitle: Boolean(row.seoTitle?.trim()),
        hasFocusKeyword: Boolean(row.focusKeyword?.trim()),
        hasOgImage: Boolean(row.ogImageUrl?.trim() || row.coverImageUrl?.trim()),
        robotsIndex: row.robotsIndex,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      siteUrl,
      healthScore,
      healthGrade,
      inventory: {
        categories,
        posts,
        pages,
        publishedPosts,
        publishedPages,
        drafts,
        archived,
        redirects,
        publicAuthors,
        noindexPublished,
      },
      coverage,
      issues,
      recentPublished,
      topKeywords: topKeywords.slice(0, 12),
      quickLinks: [
        { label: 'Sitemap blog', href: `${siteUrl}/sitemap/blog.xml`, external: true },
        { label: 'Sitemap pages', href: `${siteUrl}/sitemap/pages.xml`, external: true },
        { label: 'robots.txt', href: `${siteUrl}/robots.txt`, external: true },
        { label: 'Cẩm nang', href: `${siteUrl}/cam-nang`, external: true },
        { label: 'Bài viết', href: '/admin/posts' },
        { label: 'Trang', href: '/admin/pages' },
        { label: 'Danh mục', href: '/admin/categories' },
        { label: 'Redirect 301', href: '/admin/redirects' },
      ],
    };
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

  // ---- Footer (Footer 1 / Footer 2 + copyright) ----

  private emptyFooterColumns(): CmsFooterBlock['columns'] {
    return [{ html: '' }, { html: '' }, { html: '' }, { html: '' }];
  }

  private defaultFooterSettings(): CmsFooterSettingsView {
    return {
      footer1: { enabled: true, columns: this.emptyFooterColumns() },
      footer2: { enabled: false, columns: this.emptyFooterColumns() },
      copyrightText: '©2026 Inlink Vietnam JSC. All rights reserved.',
      updatedAt: new Date().toISOString(),
    };
  }

  private parseFooterColumns(raw: unknown): CmsFooterBlock['columns'] {
    const cols = this.emptyFooterColumns();
    if (!Array.isArray(raw)) return cols;
    for (let i = 0; i < 4; i++) {
      const item = raw[i];
      if (typeof item === 'string') {
        cols[i] = { html: item };
      } else if (item && typeof item === 'object' && 'html' in item) {
        cols[i] = { html: String((item as { html?: unknown }).html ?? '') };
      }
    }
    return cols;
  }

  private mapFooterSettings(row: {
    footer1Enabled: boolean;
    footer1Columns: unknown;
    footer2Enabled: boolean;
    footer2Columns: unknown;
    copyrightText: string;
    updatedAt: Date;
  }): CmsFooterSettingsView {
    return {
      footer1: {
        enabled: row.footer1Enabled,
        columns: this.parseFooterColumns(row.footer1Columns),
      },
      footer2: {
        enabled: row.footer2Enabled,
        columns: this.parseFooterColumns(row.footer2Columns),
      },
      copyrightText: row.copyrightText || '©2026 Inlink Vietnam JSC. All rights reserved.',
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getFooterSettings(): Promise<CmsFooterSettingsView> {
    const row = await this.prisma.cmsFooterSettings.findUnique({
      where: { tenantId: 'default' },
    });
    if (!row) return this.defaultFooterSettings();
    return this.mapFooterSettings(row);
  }

  async saveFooterSettings(
    user: AuthenticatedUser,
    input: UpsertCmsFooterSettingsRequest,
  ): Promise<CmsFooterSettingsView> {
    const normalizeBlock = (block: CmsFooterBlock): CmsFooterBlock => {
      const columns = this.emptyFooterColumns();
      for (let i = 0; i < 4; i++) {
        const html = sanitizeCmsHtml(block.columns?.[i]?.html ?? '');
        columns[i] = { html };
      }
      return { enabled: Boolean(block.enabled), columns };
    };
    const footer1 = normalizeBlock(input.footer1);
    const footer2 = normalizeBlock(input.footer2);
    const copyrightText =
      input.copyrightText?.trim() || '©2026 Inlink Vietnam JSC. All rights reserved.';

    const row = await this.prisma.cmsFooterSettings.upsert({
      where: { tenantId: 'default' },
      create: {
        tenantId: 'default',
        footer1Enabled: footer1.enabled,
        footer1Columns: footer1.columns as unknown as Prisma.InputJsonValue,
        footer2Enabled: footer2.enabled,
        footer2Columns: footer2.columns as unknown as Prisma.InputJsonValue,
        copyrightText,
        updatedBy: user.id,
      },
      update: {
        footer1Enabled: footer1.enabled,
        footer1Columns: footer1.columns as unknown as Prisma.InputJsonValue,
        footer2Enabled: footer2.enabled,
        footer2Columns: footer2.columns as unknown as Prisma.InputJsonValue,
        copyrightText,
        updatedBy: user.id,
      },
    });
    return this.mapFooterSettings(row);
  }

  // ---- Homepage SEO / hero ----

  private defaultHomepageSettings(): CmsHomepageSettingsView {
    return {
      heading: 'Tìm đúng cơ hội trong ngành công nghiệp',
      headingAccent: 'ngành công nghiệp',
      subtitle:
        'Hàng nghìn cơ hội việc làm từ các doanh nghiệp uy tín trong lĩnh vực kỹ thuật, sản xuất, vận hành và kinh doanh B2B.',
      seoTitle: 'inlink — Kết nối nhân tài, dẫn lối công nghiệp',
      seoDescription:
        'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa. Kết nối nhân tài công nghiệp B2B trên inlink.',
      focusKeyword: 'việc làm công nghiệp',
      canonicalPath: '/',
      ogTitle: null,
      ogDescription: null,
      ogImageUrl: null,
      robotsIndex: true,
      robotsFollow: true,
      robotsMaxImagePreview: true,
      updatedAt: new Date().toISOString(),
    };
  }

  private mapHomepageSettings(row: {
    heading: string;
    headingAccent: string | null;
    subtitle: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    focusKeyword: string | null;
    canonicalPath: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImageUrl: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    robotsMaxImagePreview: boolean;
    updatedAt: Date;
  }): CmsHomepageSettingsView {
    return {
      heading: row.heading,
      headingAccent: row.headingAccent,
      subtitle: row.subtitle,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      focusKeyword: row.focusKeyword,
      canonicalPath: row.canonicalPath || '/',
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImageUrl: row.ogImageUrl,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      robotsMaxImagePreview: row.robotsMaxImagePreview,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getHomepageSettings(): Promise<CmsHomepageSettingsView> {
    const row = await this.prisma.cmsHomepageSettings.findUnique({
      where: { tenantId: 'default' },
    });
    if (!row) return this.defaultHomepageSettings();
    return this.mapHomepageSettings(row);
  }

  async saveHomepageSettings(
    user: AuthenticatedUser,
    input: UpsertCmsHomepageSettingsRequest,
  ): Promise<CmsHomepageSettingsView> {
    const heading = input.heading?.trim();
    if (!heading) throw new BadRequestException('Heading (H1) là bắt buộc');
    const accent = this.emptyToNull(input.headingAccent);
    if (accent && !heading.toLowerCase().includes(accent.toLowerCase())) {
      throw new BadRequestException('Đoạn tô màu (accent) phải nằm trong H1');
    }
    const data = {
      heading,
      headingAccent: accent,
      subtitle: this.emptyToNull(input.subtitle),
      seoTitle: this.emptyToNull(input.seoTitle),
      seoDescription: this.emptyToNull(input.seoDescription),
      focusKeyword: this.emptyToNull(input.focusKeyword),
      canonicalPath: this.emptyToNull(input.canonicalPath) || '/',
      ogTitle: this.emptyToNull(input.ogTitle),
      ogDescription: this.emptyToNull(input.ogDescription),
      ogImageUrl: this.emptyToNull(input.ogImageUrl),
      robotsIndex: input.robotsIndex ?? true,
      robotsFollow: input.robotsFollow ?? true,
      robotsMaxImagePreview: input.robotsMaxImagePreview ?? true,
      updatedBy: user.id,
    };
    const row = await this.prisma.cmsHomepageSettings.upsert({
      where: { tenantId: 'default' },
      create: { tenantId: 'default', ...data },
      update: data,
    });
    return this.mapHomepageSettings(row);
  }

  // ---- robots.txt (RankMath-style) ----

  private sitePublicBase(): string {
    return (
      process.env.PUBLIC_SITE_URL ||
      process.env.WEB_ORIGIN ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private defaultRobotsContent(): string {
    return buildDefaultRobotsTxt(this.sitePublicBase());
  }

  async getRobotsSettings(): Promise<CmsRobotsSettingsView> {
    const defaultContent = this.defaultRobotsContent();
    const row = await this.prisma.cmsRobotsSettings.findUnique({
      where: { tenantId: 'default' },
    });
    if (!row) {
      return {
        content: defaultContent,
        isCustom: false,
        defaultContent,
        updatedAt: null,
      };
    }
    return {
      content: row.content,
      isCustom: true,
      defaultContent,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Plain text cho /robots.txt public. */
  async getRobotsTxtBody(): Promise<string> {
    const settings = await this.getRobotsSettings();
    return settings.content;
  }

  async saveRobotsSettings(
    user: AuthenticatedUser,
    input: UpsertCmsRobotsSettingsRequest,
  ): Promise<CmsRobotsSettingsView> {
    const content = input.content?.replace(/\r\n/g, '\n').trim();
    if (!content) throw new BadRequestException('Nội dung robots.txt không được trống');
    if (content.length > 100_000) {
      throw new BadRequestException('robots.txt quá dài (tối đa 100KB)');
    }
    const row = await this.prisma.cmsRobotsSettings.upsert({
      where: { tenantId: 'default' },
      create: { tenantId: 'default', content, updatedBy: user.id },
      update: { content, updatedBy: user.id },
    });
    return {
      content: row.content,
      isCustom: true,
      defaultContent: this.defaultRobotsContent(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Xoá bản custom → quay về mặc định hệ thống. */
  async deleteRobotsSettings(user: AuthenticatedUser): Promise<CmsRobotsSettingsView> {
    await this.prisma.cmsRobotsSettings.deleteMany({ where: { tenantId: 'default' } });
    void user;
    return this.getRobotsSettings();
  }

  // ---- Insert Headers and Footers ----

  private defaultSiteCodeSettings(): CmsSiteCodeSettingsView {
    return {
      headerEnabled: true,
      headerCode: '',
      footerEnabled: true,
      footerCode: '',
      updatedAt: new Date().toISOString(),
    };
  }

  private mapSiteCodeSettings(row: {
    headerEnabled: boolean;
    headerCode: string;
    footerEnabled: boolean;
    footerCode: string;
    updatedAt: Date;
  }): CmsSiteCodeSettingsView {
    return {
      headerEnabled: row.headerEnabled,
      headerCode: row.headerCode ?? '',
      footerEnabled: row.footerEnabled,
      footerCode: row.footerCode ?? '',
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getSiteCodeSettings(): Promise<CmsSiteCodeSettingsView> {
    const row = await this.prisma.cmsSiteCodeSettings.findUnique({
      where: { tenantId: 'default' },
    });
    if (!row) return this.defaultSiteCodeSettings();
    return this.mapSiteCodeSettings(row);
  }

  async saveSiteCodeSettings(
    user: AuthenticatedUser,
    input: UpsertCmsSiteCodeSettingsRequest,
  ): Promise<CmsSiteCodeSettingsView> {
    const existing = await this.prisma.cmsSiteCodeSettings.findUnique({
      where: { tenantId: 'default' },
    });
    const headerCode = input.headerCode ?? existing?.headerCode ?? '';
    const footerCode = input.footerCode ?? existing?.footerCode ?? '';
    if (headerCode.length > 200_000 || footerCode.length > 200_000) {
      throw new BadRequestException('Mã Header/Footer quá dài (tối đa 200KB mỗi ô)');
    }
    const data = {
      headerEnabled: input.headerEnabled ?? existing?.headerEnabled ?? true,
      headerCode,
      footerEnabled: input.footerEnabled ?? existing?.footerEnabled ?? true,
      footerCode,
      updatedBy: user.id,
    };
    const row = await this.prisma.cmsSiteCodeSettings.upsert({
      where: { tenantId: 'default' },
      create: { tenantId: 'default', ...data },
      update: data,
    });
    return this.mapSiteCodeSettings(row);
  }

  // ---- Menus (trang chủ — kiểu WP Appearance → Menus) ----

  async getMenuByLocation(
    location: string,
    ensureDefaults = false,
  ): Promise<CmsMenuView> {
    const loc = this.normalizeMenuLocation(location);
    let menu = await this.prisma.cmsMenu.findUnique({
      where: { tenantId_location: { tenantId: 'default', location: loc } },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!menu && ensureDefaults) {
      menu = await this.seedDefaultMenu(loc, null);
    }
    if (!menu) {
      return {
        id: '',
        location: loc,
        name: loc === CmsMenuLocation.Primary ? 'Menu chính' : 'Menu chân trang',
        items: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return this.mapMenu(menu);
  }

  async saveMenu(
    user: AuthenticatedUser,
    location: string,
    input: SaveCmsMenuRequest,
  ): Promise<CmsMenuView> {
    const loc = this.normalizeMenuLocation(location);
    if (!Array.isArray(input.items)) {
      throw new BadRequestException('items phải là mảng');
    }
    if (input.items.length > 40) {
      throw new BadRequestException('Tối đa 40 mục menu');
    }

    const menu = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.cmsMenu.upsert({
        where: { tenantId_location: { tenantId: 'default', location: loc } },
        create: {
          location: loc,
          name:
            input.name?.trim() ||
            (loc === CmsMenuLocation.Primary ? 'Menu chính' : 'Menu chân trang'),
          createdBy: user.id,
          updatedBy: user.id,
        },
        update: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          updatedBy: user.id,
        },
      });

      await tx.cmsMenuItem.deleteMany({ where: { menuId: upserted.id } });

      const idMap = new Map<string, string>();
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]!;
        const clientKey = item.id?.trim() || `anon-${i}`;
        idMap.set(clientKey, uuidv7());
      }

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]!;
        const clientKey = item.id?.trim() || `anon-${i}`;
        const dbId = idMap.get(clientKey)!;
        await tx.cmsMenuItem.create({
          data: {
            id: dbId,
            menuId: upserted.id,
            parentId: null,
            label: item.label.trim(),
            url: this.normalizeMenuUrl(item.url),
            sortOrder: item.sortOrder ?? i,
            openInNewTab: Boolean(item.openInNewTab),
            objectType: item.objectType || 'custom',
            objectId: item.objectId || null,
          },
        });
      }

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]!;
        const clientKey = item.id?.trim() || `anon-${i}`;
        const dbId = idMap.get(clientKey)!;
        const parentKey = item.parentId?.trim();
        if (!parentKey) continue;
        const parentDb = idMap.get(parentKey);
        if (!parentDb || parentDb === dbId) continue;
        await tx.cmsMenuItem.update({
          where: { id: dbId },
          data: { parentId: parentDb },
        });
      }

      return tx.cmsMenu.findUniqueOrThrow({
        where: { id: upserted.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return this.mapMenu(menu);
  }

  private normalizeMenuLocation(location: string): CmsMenuLocation {
    if (location === CmsMenuLocation.Footer) return CmsMenuLocation.Footer;
    if (location === CmsMenuLocation.Primary) return CmsMenuLocation.Primary;
    throw new BadRequestException('location phải là primary hoặc footer');
  }

  private normalizeMenuUrl(url: string): string {
    const u = (url || '').trim();
    if (!u) throw new BadRequestException('URL menu không được trống');
    if (/^javascript:/i.test(u)) throw new BadRequestException('URL không hợp lệ');
    return u;
  }

  private async seedDefaultMenu(location: CmsMenuLocation, userId: string | null) {
    const name = location === CmsMenuLocation.Primary ? 'Menu chính' : 'Menu chân trang';
    const defaults =
      location === CmsMenuLocation.Primary
        ? [
            { label: 'Việc làm', url: '/viec-lam', sortOrder: 0 },
            { label: 'Tạo CV', url: '/login?next=%2Fcv%2Fcreate', sortOrder: 1 },
            { label: 'Cẩm nang nghề nghiệp', url: '/cam-nang', sortOrder: 2 },
          ]
        : [
            { label: 'Việc làm', url: '/viec-lam', sortOrder: 0 },
            { label: 'Cẩm nang', url: '/cam-nang', sortOrder: 1 },
          ];

    return this.prisma.cmsMenu.create({
      data: {
        location,
        name,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: defaults.map((d) => ({
            label: d.label,
            url: d.url,
            sortOrder: d.sortOrder,
            objectType: 'custom',
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private mapMenu(
    menu: {
      id: string;
      location: string;
      name: string;
      updatedAt: Date;
      items: {
        id: string;
        parentId: string | null;
        label: string;
        url: string;
        sortOrder: number;
        openInNewTab: boolean;
        objectType: string;
        objectId: string | null;
      }[];
    },
  ): CmsMenuView {
    const byParent = new Map<string | null, typeof menu.items>();
    for (const item of menu.items) {
      const key = item.parentId;
      const list = byParent.get(key) ?? [];
      list.push(item);
      byParent.set(key, list);
    }
    const mapItem = (item: (typeof menu.items)[number]): CmsMenuItemView => ({
      id: item.id,
      parentId: item.parentId,
      label: item.label,
      url: item.url,
      sortOrder: item.sortOrder,
      openInNewTab: item.openInNewTab,
      objectType: (item.objectType as CmsMenuItemView['objectType']) || 'custom',
      objectId: item.objectId,
      children: (byParent.get(item.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(mapItem),
    });
    const roots = (byParent.get(null) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: menu.id,
      location: menu.location,
      name: menu.name,
      items: roots.map(mapItem),
      updatedAt: menu.updatedAt.toISOString(),
    };
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

  private resolveCategoryRobots(
    input: UpsertCmsCategoryRequest,
    existing?: CmsCategory,
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

  /** Đã published và đến giờ (publishedAt null = hiện ngay). */
  private isPubliclyLive(status: string, publishedAt: Date | null | undefined): boolean {
    if (status !== CmsContentStatus.Published) return false;
    if (!publishedAt) return true;
    return publishedAt.getTime() <= Date.now();
  }

  /** Bài khách được thấy: published, chưa xoá, publishedAt null hoặc đã đến. */
  private livePostWhere(extra: Prisma.CmsPostWhereInput = {}): Prisma.CmsPostWhereInput {
    return {
      ...extra,
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
  }

  /** Parse ISO / datetime-local; null = xoá ngày. */
  private parseOptionalDate(value: string | null | undefined): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('publishedAt không hợp lệ');
    }
    return d;
  }

  private resolvePublishedAt(
    input: string | null | undefined,
    publish: boolean,
    existing: Date | null,
  ): Date | null {
    if (input !== undefined) {
      const parsed = this.parseOptionalDate(input);
      if (parsed) return parsed;
      return publish ? new Date() : null;
    }
    if (publish) return existing ?? new Date();
    return existing;
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

  /** Mô tả danh mục HTML — sanitize; rỗng → null. */
  private normalizeCategoryDescription(raw?: string | null): string | null {
    if (raw == null || !raw.trim()) return null;
    const html = sanitizeCmsHtml(raw);
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? html : null;
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
      avatarUrl: row.avatarUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      focusKeyword: row.focusKeyword,
      canonicalPath: row.canonicalPath,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImageUrl: row.ogImageUrl,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      robotsMaxImagePreview: row.robotsMaxImagePreview,
      robots: row.robots,
      faq: this.parseFaq(row.faqJson),
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

  /** Đảm bảo user có hồ sơ tác giả tối thiểu (không public cho đến khi SuperAdmin bật). */
  async ensureAuthorProfile(user: AuthenticatedUser): Promise<CmsAuthorProfile> {
    const existing = await this.prisma.cmsAuthorProfile.findUnique({
      where: { userId: user.id },
    });
    if (existing) return existing;
    return this.prisma.cmsAuthorProfile.create({
      data: {
        userId: user.id,
        displayName: user.displayName?.trim() || user.email,
        isPublic: false,
        updatedBy: user.id,
      },
    });
  }

  async listAuthorProfiles(): Promise<CmsAuthorProfileView[]> {
    const rows = await this.prisma.cmsAuthorProfile.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
    const userIds = rows.map((r) => r.userId);
    const [users, postCounts] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true },
      }),
      this.prisma.cmsPost.groupBy({
        by: ['authorId'],
        where: this.livePostWhere({
          authorId: { in: userIds },
          type: CmsContentType.Post,
        }),
        _count: { _all: true },
      }),
    ]);
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const countById = new Map(postCounts.map((p) => [p.authorId, p._count._all]));
    return rows.map((r) =>
      this.mapAuthorProfile(r, emailById.get(r.userId) ?? null, countById.get(r.userId) ?? 0),
    );
  }

  /** Tài khoản chưa có hồ sơ tác giả — để SuperAdmin gán. */
  async listUsersWithoutAuthorProfile(): Promise<
    Array<{ id: string; email: string; displayName: string; role: string }>
  > {
    const withProfile = await this.prisma.cmsAuthorProfile.findMany({
      select: { userId: true },
    });
    const taken = new Set(withProfile.map((p) => p.userId));
    const users = await this.prisma.user.findMany({
      where: { isDeleted: false },
      select: { id: true, email: true, displayName: true, role: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    });
    return users
      .filter((u) => !taken.has(u.id))
      .map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName || u.email,
        role: u.role,
      }));
  }

  async getAuthorProfileAdmin(userId: string): Promise<CmsAuthorProfileView> {
    const row = await this.prisma.cmsAuthorProfile.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ tác giả');
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const postCount = await this.prisma.cmsPost.count({
      where: this.livePostWhere({
        authorId: userId,
        type: CmsContentType.Post,
      }),
    });
    return this.mapAuthorProfile(row, u?.email ?? null, postCount);
  }

  async getMyAuthorProfile(user: AuthenticatedUser): Promise<CmsAuthorProfileView> {
    const profile = await this.ensureAuthorProfile(user);
    return this.mapAuthorProfile(profile, user.email);
  }

  async assignAuthorProfile(
    admin: AuthenticatedUser,
    input: AssignCmsAuthorProfileRequest,
  ): Promise<CmsAuthorProfileView> {
    const target = await this.prisma.user.findFirst({
      where: { id: input.userId, isDeleted: false },
      select: { id: true, email: true, displayName: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản');
    const existing = await this.prisma.cmsAuthorProfile.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      throw new BadRequestException('Tài khoản đã có hồ sơ tác giả — hãy sửa hồ sơ hiện có');
    }
    const displayName =
      input.displayName?.trim() || target.displayName?.trim() || target.email;
    if (!displayName) throw new BadRequestException('Tên tác giả không được để trống');
    const title = this.emptyToNull(input.title);
    if (!title) throw new BadRequestException('Chức danh (Job Title) là bắt buộc');

    const slug = await this.uniqueAuthorSlug(
      input.slug || displayName,
      undefined,
    );
    const row = await this.prisma.cmsAuthorProfile.create({
      data: {
        userId: input.userId,
        displayName,
        title,
        bio: this.emptyToNull(input.bio),
        avatarUrl: this.emptyToNull(input.avatarUrl),
        worksFor: this.emptyToNull(input.worksFor) || 'inlink',
        slug,
        isPublic: input.isPublic ?? true,
        websiteUrl: this.emptyToNull(input.websiteUrl),
        facebookUrl: this.emptyToNull(input.facebookUrl),
        linkedinUrl: this.emptyToNull(input.linkedinUrl),
        twitterUrl: this.emptyToNull(input.twitterUrl),
        youtubeUrl: this.emptyToNull(input.youtubeUrl),
        seoTitle: this.emptyToNull(input.seoTitle),
        seoDescription: this.emptyToNull(input.seoDescription),
        focusKeyword: this.emptyToNull(input.focusKeyword),
        canonicalPath: this.emptyToNull(input.canonicalPath),
        ogTitle: this.emptyToNull(input.ogTitle),
        ogDescription: this.emptyToNull(input.ogDescription),
        ogImageUrl: this.emptyToNull(input.ogImageUrl),
        robotsIndex: input.robotsIndex ?? true,
        robotsFollow: input.robotsFollow ?? true,
        robotsMaxImagePreview: input.robotsMaxImagePreview ?? true,
        updatedBy: admin.id,
      },
    });
    await this.syncAuthorSnapshots(row);
    return this.mapAuthorProfile(row, target.email);
  }

  async updateAuthorProfileAdmin(
    admin: AuthenticatedUser,
    userId: string,
    input: UpsertCmsAuthorProfileRequest,
  ): Promise<CmsAuthorProfileView> {
    const existing = await this.prisma.cmsAuthorProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Không tìm thấy hồ sơ tác giả');
    const displayName = input.displayName?.trim();
    if (!displayName) throw new BadRequestException('Tên tác giả không được để trống');
    const title =
      input.title !== undefined ? this.emptyToNull(input.title) : existing.title;
    if (!title) throw new BadRequestException('Chức danh (Job Title) là bắt buộc');

    let slug = existing.slug;
    if (input.slug !== undefined) {
      const next = this.emptyToNull(input.slug);
      slug = next ? await this.uniqueAuthorSlug(next, userId) : null;
    } else if (!slug) {
      slug = await this.uniqueAuthorSlug(displayName, userId);
    }

    const isPublic = input.isPublic ?? existing.isPublic;
    if (isPublic && !slug) {
      throw new BadRequestException('Trang public cần slug /tac-gia/...');
    }

    const row = await this.prisma.cmsAuthorProfile.update({
      where: { userId },
      data: {
        displayName,
        title,
        bio: input.bio !== undefined ? this.emptyToNull(input.bio) : undefined,
        avatarUrl: input.avatarUrl !== undefined ? this.emptyToNull(input.avatarUrl) : undefined,
        worksFor: input.worksFor !== undefined ? this.emptyToNull(input.worksFor) : undefined,
        slug,
        isPublic,
        websiteUrl:
          input.websiteUrl !== undefined ? this.emptyToNull(input.websiteUrl) : undefined,
        facebookUrl:
          input.facebookUrl !== undefined ? this.emptyToNull(input.facebookUrl) : undefined,
        linkedinUrl:
          input.linkedinUrl !== undefined ? this.emptyToNull(input.linkedinUrl) : undefined,
        twitterUrl:
          input.twitterUrl !== undefined ? this.emptyToNull(input.twitterUrl) : undefined,
        youtubeUrl:
          input.youtubeUrl !== undefined ? this.emptyToNull(input.youtubeUrl) : undefined,
        seoTitle: input.seoTitle !== undefined ? this.emptyToNull(input.seoTitle) : undefined,
        seoDescription:
          input.seoDescription !== undefined ? this.emptyToNull(input.seoDescription) : undefined,
        focusKeyword:
          input.focusKeyword !== undefined ? this.emptyToNull(input.focusKeyword) : undefined,
        canonicalPath:
          input.canonicalPath !== undefined ? this.emptyToNull(input.canonicalPath) : undefined,
        ogTitle: input.ogTitle !== undefined ? this.emptyToNull(input.ogTitle) : undefined,
        ogDescription:
          input.ogDescription !== undefined ? this.emptyToNull(input.ogDescription) : undefined,
        ogImageUrl:
          input.ogImageUrl !== undefined ? this.emptyToNull(input.ogImageUrl) : undefined,
        robotsIndex: input.robotsIndex ?? undefined,
        robotsFollow: input.robotsFollow ?? undefined,
        robotsMaxImagePreview: input.robotsMaxImagePreview ?? undefined,
        updatedBy: admin.id,
      },
    });
    await this.syncAuthorSnapshots(row);
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return this.mapAuthorProfile(row, u?.email ?? null);
  }

  async updateMyAuthorProfile(
    user: AuthenticatedUser,
    input: UpsertCmsAuthorProfileRequest,
  ): Promise<CmsAuthorProfileView> {
    await this.ensureAuthorProfile(user);
    return this.updateAuthorProfileAdmin(user, user.id, input);
  }

  async getPublishedAuthorBySlug(slug: string): Promise<CmsAuthorProfileView | null> {
    const row = await this.prisma.cmsAuthorProfile.findFirst({
      where: { slug, isPublic: true },
    });
    if (!row) return null;
    const u = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { email: true },
    });
    return this.mapAuthorProfile(row, u?.email ?? null);
  }

  async listPublicAuthors(): Promise<CmsAuthorProfileView[]> {
    const rows = await this.prisma.cmsAuthorProfile.findMany({
      where: { isPublic: true, robotsIndex: true, slug: { not: null } },
      orderBy: { displayName: 'asc' },
    });
    return rows.map((r) => this.mapAuthorProfile(r, null));
  }

  private emptyToNull(v?: string | null): string | null {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t || null;
  }

  private async uniqueAuthorSlug(base: string, excludeUserId?: string): Promise<string> {
    const taken = await this.prisma.cmsAuthorProfile.findMany({
      where: {
        slug: { not: null },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { slug: true },
    });
    return nextUniqueSlug(
      toSeoSlug(base),
      taken.map((t) => t.slug!).filter(Boolean),
    );
  }

  private async syncAuthorSnapshots(row: CmsAuthorProfile): Promise<void> {
    await this.prisma.cmsPost.updateMany({
      where: { authorId: row.userId, isDeleted: false },
      data: {
        authorName: row.displayName,
        authorTitle: row.title,
        authorBio: row.bio,
      },
    });
  }

  private async resolveAuthorSnapshot(authorId: string): Promise<{
    displayName: string;
    title: string | null;
    bio: string | null;
  }> {
    const profile = await this.prisma.cmsAuthorProfile.findUnique({
      where: { userId: authorId },
    });
    if (profile) {
      return {
        displayName: profile.displayName,
        title: profile.title,
        bio: profile.bio,
      };
    }
    const u = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { displayName: true, email: true },
    });
    return {
      displayName: u?.displayName || u?.email || 'Tác giả',
      title: null,
      bio: null,
    };
  }

  private emptySocial(): CmsAuthorSocial {
    return {
      website: null,
      facebook: null,
      linkedin: null,
      twitter: null,
      youtube: null,
    };
  }

  private mapAuthorSocial(row: CmsAuthorProfile | null): CmsAuthorSocial {
    if (!row) return this.emptySocial();
    return {
      website: row.websiteUrl,
      facebook: row.facebookUrl,
      linkedin: row.linkedinUrl,
      twitter: row.twitterUrl,
      youtube: row.youtubeUrl,
    };
  }

  private mapAuthorProfile(
    row: CmsAuthorProfile,
    email: string | null,
    postCount?: number,
  ): CmsAuthorProfileView {
    return {
      userId: row.userId,
      email,
      slug: row.slug,
      displayName: row.displayName,
      title: row.title,
      bio: row.bio,
      avatarUrl: row.avatarUrl,
      worksFor: row.worksFor,
      isPublic: row.isPublic,
      social: this.mapAuthorSocial(row),
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      focusKeyword: row.focusKeyword,
      canonicalPath: row.canonicalPath,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImageUrl: row.ogImageUrl,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      robotsMaxImagePreview: row.robotsMaxImagePreview,
      postCount,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async mapPostView(row: PostWithCategory): Promise<CmsPostView> {
    const profile = await this.prisma.cmsAuthorProfile.findUnique({
      where: { userId: row.authorId },
    });
    let fallbackName = row.authorName;
    if (!profile && !fallbackName) {
      const u = await this.prisma.user.findUnique({
        where: { id: row.authorId },
        select: { displayName: true },
      });
      fallbackName = u?.displayName ?? null;
    }
    const authorSlug = profile?.isPublic && profile.slug ? profile.slug : null;
    return {
      ...this.mapPostList(row),
      bodyHtml: row.bodyHtml,
      authorId: row.authorId,
      authorName: profile?.displayName || fallbackName,
      authorTitle: profile?.title ?? row.authorTitle,
      authorBio: profile?.bio ?? row.authorBio,
      authorAvatarUrl: profile?.avatarUrl ?? null,
      authorSocial: this.mapAuthorSocial(profile),
      authorSlug,
      authorWorksFor: profile?.worksFor ?? null,
      seoDescription: row.seoDescription,
      focusKeyword: row.focusKeyword,
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
