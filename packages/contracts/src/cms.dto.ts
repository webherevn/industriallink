import { CmsContentStatus, CmsContentType } from './enums';

export interface CmsFaqItem {
  question: string;
  answer: string;
}

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
  robotsIndex: boolean;
  updatedAt: string;
}

export interface CmsPostView extends CmsPostListItem {
  bodyHtml: string;
  authorId: string;
  authorName: string | null;
  authorTitle: string | null;
  authorBio: string | null;
  seoDescription: string | null;
  canonicalPath: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  robots: string;
  robotsFollow: boolean;
  robotsMaxImagePreview: boolean;
  faq: CmsFaqItem[];
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
  authorName?: string | null;
  authorTitle?: string | null;
  authorBio?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalPath?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  robotsMaxImagePreview?: boolean;
  /** @deprecated dùng robotsIndex/robotsFollow */
  robots?: string;
  faq?: CmsFaqItem[];
  /** Nếu true → published; false → draft. */
  publish?: boolean;
}

export interface ListCmsPostsQuery {
  type?: CmsContentType;
  status?: CmsContentStatus;
  category?: string;
  limit?: number;
}

export interface CmsRedirectView {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCmsRedirectRequest {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  note?: string | null;
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

export function buildCmsRobotsString(index: boolean, follow: boolean): string {
  return `${index ? 'index' : 'noindex'},${follow ? 'follow' : 'nofollow'}`;
}
