import { CmsContentStatus, CmsContentType } from './enums';

export interface CmsCategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  robots: string;
  createdAt: string;
  updatedAt: string;
}

export interface CmsPostListItem {
  id: string;
  type: CmsContentType;
  title: string;
  slug: string;
  excerpt: string | null;
  status: CmsContentStatus;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  seoTitle: string | null;
  updatedAt: string;
}

export interface CmsPostView extends CmsPostListItem {
  bodyHtml: string;
  authorId: string;
  seoDescription: string | null;
  canonicalPath: string | null;
  ogImageUrl: string | null;
  robots: string;
  createdAt: string;
}

export interface UpsertCmsCategoryRequest {
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  robots?: string;
}

export interface UpsertCmsPostRequest {
  type: CmsContentType;
  title: string;
  slug?: string;
  excerpt?: string | null;
  bodyHtml?: string;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  ogImageUrl?: string | null;
  robots?: string;
  /** Nếu true → published; false → draft. Mặc định giữ nguyên / draft khi tạo. */
  publish?: boolean;
}

export interface ListCmsPostsQuery {
  type?: CmsContentType;
  status?: CmsContentStatus;
  category?: string;
  limit?: number;
}

/** URL công khai bài viết cẩm nang. */
export function cmsPostPublicPath(slug: string): string {
  return `/cam-nang/${slug}`;
}

/** URL công khai trang tĩnh. */
export function cmsPagePublicPath(slug: string): string {
  return `/trang/${slug}`;
}

export function cmsContentPublicPath(type: CmsContentType, slug: string): string {
  return type === CmsContentType.Page ? cmsPagePublicPath(slug) : cmsPostPublicPath(slug);
}
