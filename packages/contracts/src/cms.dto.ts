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

export interface CmsAuthorSocial {
  website: string | null;
  facebook: string | null;
  linkedin: string | null;
  twitter: string | null;
  youtube: string | null;
}

/** Hồ sơ tác giả CMS (chỉnh trong SuperAdmin → Tác giả). */
export interface CmsAuthorProfileView {
  userId: string;
  email: string | null;
  displayName: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  social: CmsAuthorSocial;
  updatedAt: string;
}

export interface UpsertCmsAuthorProfileRequest {
  displayName: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
}

export interface CmsPostView extends CmsPostListItem {
  bodyHtml: string;
  authorId: string;
  authorName: string | null;
  authorTitle: string | null;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  authorSocial: CmsAuthorSocial;
  seoDescription: string | null;
  focusKeyword: string | null;
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
  /** @deprecated Tác giả lấy từ hồ sơ tài khoản đăng bài — bỏ qua nếu gửi. */
  authorName?: string | null;
  /** @deprecated */
  authorTitle?: string | null;
  /** @deprecated */
  authorBio?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
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
  /** ISO datetime — cho phép chỉnh ngày đăng (giống WP). */
  publishedAt?: string | null;
}

export interface ListCmsPostsQuery {
  type?: CmsContentType;
  status?: CmsContentStatus;
  category?: string;
  limit?: number;
  /** 1-based page (public list). */
  page?: number;
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

/** URL danh mục cẩm nang (trang 1). */
export function cmsCategoryPublicPath(slug: string): string {
  return `/cam-nang/chuyen-muc/${slug}`;
}

/** URL danh mục phân trang: /cam-nang/chuyen-muc/{slug}/page/{n} */
export function cmsCategoryPagePath(slug: string, page: number): string {
  if (page <= 1) return cmsCategoryPublicPath(slug);
  return `/cam-nang/chuyen-muc/${slug}/page/${page}`;
}

export function cmsContentPublicPath(type: CmsContentType, slug: string): string {
  return type === CmsContentType.Page ? cmsPagePublicPath(slug) : cmsPostPublicPath(slug);
}

export interface CmsPostListPage {
  items: CmsPostListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function buildCmsRobotsString(index: boolean, follow: boolean): string {
  return `${index ? 'index' : 'noindex'},${follow ? 'follow' : 'nofollow'}`;
}

/** Vị trí menu trang chủ (không phải nav ứng viên / NTD). */
export enum CmsMenuLocation {
  Primary = 'primary',
  Footer = 'footer',
}

export interface CmsMenuItemView {
  id: string;
  parentId: string | null;
  label: string;
  url: string;
  sortOrder: number;
  openInNewTab: boolean;
  objectType: 'custom' | 'page' | 'post';
  objectId: string | null;
  children: CmsMenuItemView[];
}

export interface CmsMenuView {
  id: string;
  location: CmsMenuLocation | string;
  name: string;
  items: CmsMenuItemView[];
  updatedAt: string;
}

export interface UpsertCmsMenuItemInput {
  /** Có id = giữ item; không id = tạo mới. */
  id?: string;
  parentId?: string | null;
  label: string;
  url: string;
  sortOrder?: number;
  openInNewTab?: boolean;
  objectType?: 'custom' | 'page' | 'post';
  objectId?: string | null;
}

export interface SaveCmsMenuRequest {
  name?: string;
  items: UpsertCmsMenuItemInput[];
}
