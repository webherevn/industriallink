import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  nextUniqueSlug,
  toSeoSlug,
  type CmsCategoryView,
  type CmsPostListItem,
  type CmsPostView,
  type ListCmsPostsQuery,
  type UpsertCmsCategoryRequest,
  type UpsertCmsPostRequest,
} from '@industriallink/contracts';
import type { CmsCategory, CmsPost } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

type PostWithCategory = CmsPost & {
  category: { id: string; name: string; slug: string } | null;
};

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Categories ----

  async listCategories(includeDeleted = false): Promise<CmsCategoryView[]> {
    const rows = await this.prisma.cmsCategory.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.mapCategory(r));
  }

  async getCategoryBySlug(slug: string): Promise<CmsCategoryView | null> {
    const row = await this.prisma.cmsCategory.findFirst({
      where: { slug, isDeleted: false },
    });
    return row ? this.mapCategory(row) : null;
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
        ...(query.category
          ? { category: { slug: query.category, isDeleted: false } }
          : {}),
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
        ...(query.category
          ? { category: { slug: query.category, isDeleted: false } }
          : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(query.limit ?? 50, 100),
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
    const row = await this.prisma.cmsPost.create({
      data: {
        type,
        title: input.title.trim(),
        slug,
        excerpt: input.excerpt ?? null,
        bodyHtml: input.bodyHtml ?? '',
        status: publish ? CmsContentStatus.Published : CmsContentStatus.Draft,
        publishedAt: publish ? new Date() : null,
        categoryId: type === CmsContentType.Page ? null : (input.categoryId ?? null),
        authorId: user.id,
        coverImageUrl: input.coverImageUrl ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        canonicalPath: input.canonicalPath ?? null,
        ogImageUrl: input.ogImageUrl ?? null,
        robots: input.robots?.trim() || 'index,follow',
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
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

    let status = existing.status;
    let publishedAt = existing.publishedAt;
    if (input.publish === true) {
      status = CmsContentStatus.Published;
      publishedAt = publishedAt ?? new Date();
    } else if (input.publish === false) {
      status = CmsContentStatus.Draft;
    }

    const row = await this.prisma.cmsPost.update({
      where: { id },
      data: {
        type,
        title: input.title?.trim() ?? existing.title,
        slug,
        excerpt: input.excerpt !== undefined ? input.excerpt : existing.excerpt,
        bodyHtml: input.bodyHtml !== undefined ? input.bodyHtml : existing.bodyHtml,
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
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : existing.seoTitle,
        seoDescription:
          input.seoDescription !== undefined ? input.seoDescription : existing.seoDescription,
        canonicalPath:
          input.canonicalPath !== undefined ? input.canonicalPath : existing.canonicalPath,
        ogImageUrl: input.ogImageUrl !== undefined ? input.ogImageUrl : existing.ogImageUrl,
        robots: input.robots?.trim() || existing.robots,
        updatedBy: user.id,
        version: { increment: 1 },
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
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
    return { message: 'Đã xoá nội dung' };
  }

  async seoOverview(): Promise<{
    categories: number;
    posts: number;
    pages: number;
    publishedPosts: number;
    publishedPages: number;
    drafts: number;
  }> {
    const [categories, posts, pages, publishedPosts, publishedPages, drafts] = await Promise.all([
      this.prisma.cmsCategory.count({ where: { isDeleted: false } }),
      this.prisma.cmsPost.count({
        where: { isDeleted: false, type: CmsContentType.Post },
      }),
      this.prisma.cmsPost.count({
        where: { isDeleted: false, type: CmsContentType.Page },
      }),
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
    ]);
    return { categories, posts, pages, publishedPosts, publishedPages, drafts };
  }

  private assertPostInput(input: UpsertCmsPostRequest): void {
    if (!input.title?.trim()) throw new BadRequestException('Thiếu tiêu đề');
    if (input.type === CmsContentType.Post && !input.categoryId) {
      // category optional for flexibility in phase 1
    }
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
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPost(row: PostWithCategory): CmsPostView {
    return {
      ...this.mapPostList(row),
      bodyHtml: row.bodyHtml,
      authorId: row.authorId,
      seoDescription: row.seoDescription,
      canonicalPath: row.canonicalPath,
      ogImageUrl: row.ogImageUrl,
      robots: row.robots,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
