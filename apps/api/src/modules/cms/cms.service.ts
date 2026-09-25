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
  cmsContentPublicPath,
  nextUniqueSlug,
  toSeoSlug,
  type CmsAuthorProfileView,
  type CmsAuthorSocial,
  type CmsCategoryView,
  type CmsFaqItem,
  type CmsMenuItemView,
  type CmsMenuView,
  type CmsPostListItem,
  type CmsPostView,
  type CmsRedirectView,
  type ListCmsPostsQuery,
  type CmsPostListPage,
  type SaveCmsMenuRequest,
  type UpsertCmsAuthorProfileRequest,
  type UpsertCmsCategoryRequest,
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

  async listPublished(query: ListCmsPostsQuery = {}): Promise<CmsPostListPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(query.limit ?? 12, 1), 200);
    const where = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      type: query.type ?? CmsContentType.Post,
      robotsIndex: true,
      ...(query.category ? { category: { slug: query.category, isDeleted: false } } : {}),
    };
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
      where: {
        type,
        slug,
        isDeleted: false,
        status: CmsContentStatus.Published,
      },
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
    if (publish && robots.index) {
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
    if (status === CmsContentStatus.Published && row.robotsIndex) {
      void this.indexing.publish(url, 'URL_UPDATED');
    } else if (existing.status === CmsContentStatus.Published) {
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

  /** Đảm bảo user có hồ sơ tác giả (tạo lần đầu từ displayName). */
  async ensureAuthorProfile(user: AuthenticatedUser): Promise<CmsAuthorProfile> {
    const existing = await this.prisma.cmsAuthorProfile.findUnique({
      where: { userId: user.id },
    });
    if (existing) return existing;
    return this.prisma.cmsAuthorProfile.create({
      data: {
        userId: user.id,
        displayName: user.displayName?.trim() || user.email,
        updatedBy: user.id,
      },
    });
  }

  async getMyAuthorProfile(user: AuthenticatedUser): Promise<CmsAuthorProfileView> {
    const profile = await this.ensureAuthorProfile(user);
    return this.mapAuthorProfile(profile, user.email);
  }

  async updateMyAuthorProfile(
    user: AuthenticatedUser,
    input: UpsertCmsAuthorProfileRequest,
  ): Promise<CmsAuthorProfileView> {
    const displayName = input.displayName?.trim();
    if (!displayName) throw new BadRequestException('Tên tác giả không được để trống');

    const emptyToNull = (v?: string | null) => {
      if (v === undefined) return undefined;
      const t = v?.trim() || '';
      return t || null;
    };

    await this.ensureAuthorProfile(user);
    const row = await this.prisma.cmsAuthorProfile.update({
      where: { userId: user.id },
      data: {
        displayName,
        title: emptyToNull(input.title),
        bio: emptyToNull(input.bio),
        avatarUrl: emptyToNull(input.avatarUrl),
        websiteUrl: emptyToNull(input.websiteUrl),
        facebookUrl: emptyToNull(input.facebookUrl),
        linkedinUrl: emptyToNull(input.linkedinUrl),
        twitterUrl: emptyToNull(input.twitterUrl),
        youtubeUrl: emptyToNull(input.youtubeUrl),
        updatedBy: user.id,
      },
    });

    // Đồng bộ snapshot trên bài của tác giả này (giống WP cập nhật display name)
    await this.prisma.cmsPost.updateMany({
      where: { authorId: user.id, isDeleted: false },
      data: {
        authorName: row.displayName,
        authorTitle: row.title,
        authorBio: row.bio,
      },
    });

    return this.mapAuthorProfile(row, user.email);
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

  private mapAuthorProfile(row: CmsAuthorProfile, email: string | null): CmsAuthorProfileView {
    return {
      userId: row.userId,
      email,
      displayName: row.displayName,
      title: row.title,
      bio: row.bio,
      avatarUrl: row.avatarUrl,
      social: this.mapAuthorSocial(row),
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
    return {
      ...this.mapPostList(row),
      bodyHtml: row.bodyHtml,
      authorId: row.authorId,
      authorName: profile?.displayName || fallbackName,
      authorTitle: profile?.title ?? row.authorTitle,
      authorBio: profile?.bio ?? row.authorBio,
      authorAvatarUrl: profile?.avatarUrl ?? null,
      authorSocial: this.mapAuthorSocial(profile),
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
