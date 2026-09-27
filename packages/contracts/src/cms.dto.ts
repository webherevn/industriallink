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
  avatarUrl: string | null;
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
  /** Legacy combined robots string */
  robots: string;
  faq: CmsFaqItem[];
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

/** Hồ sơ tác giả CMS (SuperAdmin → Tác giả). */
export interface CmsAuthorProfileView {
  userId: string;
  email: string | null;
  slug: string | null;
  displayName: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  worksFor: string | null;
  isPublic: boolean;
  social: CmsAuthorSocial;
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
  /** Số bài đã xuất bản (admin list). */
  postCount?: number;
  updatedAt: string;
}

export interface UpsertCmsAuthorProfileRequest {
  displayName: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  worksFor?: string | null;
  slug?: string | null;
  isPublic?: boolean;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
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
}

/** SuperAdmin gán hồ sơ tác giả cho một tài khoản. */
export interface AssignCmsAuthorProfileRequest extends UpsertCmsAuthorProfileRequest {
  userId: string;
}

export interface CmsPostView extends CmsPostListItem {
  bodyHtml: string;
  authorId: string;
  authorName: string | null;
  authorTitle: string | null;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  authorSocial: CmsAuthorSocial;
  /** Slug trang /tac-gia/... nếu hồ sơ public */
  authorSlug: string | null;
  authorWorksFor: string | null;
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
  /** JSON-LD tùy biến. Rỗng = dùng schema Article/WebPage mặc định. */
  customSchema: string | null;
  createdAt: string;
}

export interface UpsertCmsCategoryRequest {
  name: string;
  slug?: string;
  description?: string | null;
  sortOrder?: number;
  avatarUrl?: string | null;
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
  /** JSON-LD (object, mảng, hoặc thẻ script). Rỗng = schema mặc định. */
  customSchema?: string | null;
  /** Nếu true → published; false → draft. */
  publish?: boolean;
  /** ISO datetime — cho phép chỉnh ngày đăng (giống WP). */
  publishedAt?: string | null;
}

export interface ListCmsPostsQuery {
  type?: CmsContentType;
  status?: CmsContentStatus;
  category?: string;
  /** true = chỉ bài trong thùng rác (soft-delete). */
  trashed?: boolean;
  /** Lọc theo slug tác giả (/tac-gia/{slug}) */
  author?: string;
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

/** URL danh mục cẩm nang (trang 1): /cam-nang/{slug} */
export function cmsCategoryPublicPath(slug: string): string {
  return `/cam-nang/${slug}`;
}

/** URL danh mục phân trang: /cam-nang/{slug}/page/{n} */
export function cmsCategoryPagePath(slug: string, page: number): string {
  if (page <= 1) return cmsCategoryPublicPath(slug);
  return `/cam-nang/${slug}/page/${page}`;
}

/** URL hồ sơ tác giả công khai. */
export function cmsAuthorPublicPath(slug: string): string {
  return `/tac-gia/${slug}`;
}

export function cmsContentPublicPath(type: CmsContentType, slug: string): string {
  return type === CmsContentType.Page ? cmsPagePublicPath(slug) : cmsPostPublicPath(slug);
}

/** sameAs cho Schema Person — chỉ URL hợp lệ, không null. */
export function cmsAuthorSameAs(social: CmsAuthorSocial): string[] {
  return [social.linkedin, social.website, social.facebook, social.twitter, social.youtube].filter(
    (u): u is string => Boolean(u && /^https?:\/\//i.test(u.trim())),
  );
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

/** Một cột chân trang (HTML rich text). */
export interface CmsFooterColumn {
  html: string;
}

/** Một khối Footer (Footer 1 hoặc Footer 2). */
export interface CmsFooterBlock {
  enabled: boolean;
  /** Luôn 4 cột; cột html rỗng sẽ ẩn trên public. */
  columns: CmsFooterColumn[];
}

export interface CmsFooterSettingsView {
  footer1: CmsFooterBlock;
  footer2: CmsFooterBlock;
  copyrightText: string;
  updatedAt: string;
}

export interface UpsertCmsFooterSettingsRequest {
  footer1: CmsFooterBlock;
  footer2: CmsFooterBlock;
  copyrightText: string;
}

/** SEO + hero trang chủ (/). */
export interface CmsHomepageSettingsView {
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
  /** JSON-LD tùy biến cho trang chủ. Rỗng = không thêm schema. */
  customSchema: string | null;
  updatedAt: string;
}

export interface UpsertCmsHomepageSettingsRequest {
  heading: string;
  headingAccent?: string | null;
  subtitle?: string | null;
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
  /** JSON-LD (object, mảng, hoặc thẻ script). Rỗng = không thêm schema. */
  customSchema?: string | null;
}

const CUSTOM_SCHEMA_MAX = 50_000;

/** Chuẩn hoá JSON-LD admin dán vào. Rỗng → null. Không hợp lệ → error. */
export function parseCustomSchemaInput(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = (raw ?? '').replace(/^\uFEFF/, '').trim();
  if (!text) return { ok: true, value: null };
  if (text.length > CUSTOM_SCHEMA_MAX) {
    return { ok: false, error: 'Custom schema quá dài (tối đa 50.000 ký tự)' };
  }

  const scriptRe =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(text))) {
    const body = match[1]?.trim();
    if (body) chunks.push(body);
  }
  const sources = chunks.length > 0 ? chunks : [text];
  const nodes: unknown[] = [];

  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      return { ok: false, error: 'Custom schema phải là JSON-LD hợp lệ' };
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return { ok: false, error: 'Mỗi schema phải là một object JSON' };
        }
        nodes.push(item);
      }
      continue;
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Custom schema phải là object hoặc mảng JSON-LD' };
    }
    nodes.push(parsed);
  }

  if (nodes.length === 0) {
    return { ok: false, error: 'Custom schema không có nội dung JSON-LD' };
  }
  return { ok: true, value: JSON.stringify(nodes.length === 1 ? nodes[0] : nodes) };
}

/** Các node JSON-LD đã lưu (rỗng nếu không có hoặc không parse được). */
export function customSchemaNodes(stored: string | null | undefined): unknown[] {
  const text = stored?.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    }
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    return [];
  }
  return [];
}

/** robots.txt (RankMath-style). */
export interface CmsRobotsSettingsView {
  /** Nội dung hiệu lực (custom hoặc mặc định). */
  content: string;
  /** true nếu đã lưu bản custom trong DB. */
  isCustom: boolean;
  /** Nội dung mặc định hệ thống (để Reset / so sánh). */
  defaultContent: string;
  updatedAt: string | null;
}

export interface UpsertCmsRobotsSettingsRequest {
  content: string;
}

/** Insert Headers and Footers (WP-style). */
export interface CmsSiteCodeSettingsView {
  headerEnabled: boolean;
  headerCode: string;
  footerEnabled: boolean;
  footerCode: string;
  updatedAt: string;
}

export interface UpsertCmsSiteCodeSettingsRequest {
  headerEnabled?: boolean;
  headerCode?: string;
  footerEnabled?: boolean;
  footerCode?: string;
}

/** Mức độ nghiêm trọng của vấn đề SEO. */
export type CmsSeoIssueSeverity = 'critical' | 'warning' | 'info';

/** Loại thực thể trong SEO audit. */
export type CmsSeoEntityKind = 'post' | 'page' | 'category' | 'author';

export interface CmsSeoIssueItem {
  id: string;
  kind: CmsSeoEntityKind;
  title: string;
  slug: string;
  /** Đường dẫn sửa trong admin */
  editPath: string;
  /** URL công khai nếu có */
  publicPath: string | null;
  status?: string | null;
  updatedAt: string;
}

export interface CmsSeoIssueGroup {
  code: string;
  severity: CmsSeoIssueSeverity;
  title: string;
  description: string;
  count: number;
  items: CmsSeoIssueItem[];
}

export interface CmsSeoCoverageMetric {
  id: string;
  label: string;
  /** Số đạt chuẩn */
  done: number;
  /** Tổng mẫu (thường = published indexable) */
  total: number;
  /** 0–100 */
  percent: number;
  hint: string;
}

export interface CmsSeoRecentItem {
  id: string;
  kind: 'post' | 'page';
  title: string;
  slug: string;
  editPath: string;
  publicPath: string;
  publishedAt: string | null;
  hasSeoTitle: boolean;
  hasFocusKeyword: boolean;
  hasOgImage: boolean;
  robotsIndex: boolean;
}

export interface CmsOutboundLink {
  href: string;
  host: string;
  anchor: string;
  nofollow: boolean;
  sponsored: boolean;
}

export interface CmsOutboundSource {
  id: string;
  kind: 'post' | 'page' | 'category';
  title: string;
  editPath: string;
  publicPath: string;
  links: CmsOutboundLink[];
}

/** Link http(s) trỏ ra ngoài site, gom theo bài / trang / danh mục. */
export interface CmsOutboundReport {
  totalLinks: number;
  uniqueHosts: number;
  dofollow: number;
  nofollow: number;
  sources: number;
  topHosts: Array<{ host: string; count: number }>;
  items: CmsOutboundSource[];
}

export interface CmsSeoOverview {
  generatedAt: string;
  siteUrl: string;
  /** Điểm sức khỏe 0–100 */
  healthScore: number;
  healthGrade: 'great' | 'good' | 'ok' | 'bad';
  inventory: {
    categories: number;
    posts: number;
    pages: number;
    publishedPosts: number;
    publishedPages: number;
    drafts: number;
    archived: number;
    redirects: number;
    publicAuthors: number;
    noindexPublished: number;
  };
  coverage: CmsSeoCoverageMetric[];
  issues: CmsSeoIssueGroup[];
  recentPublished: CmsSeoRecentItem[];
  topKeywords: Array<{ keyword: string; count: number }>;
  quickLinks: Array<{ label: string; href: string; external?: boolean }>;
  outbound: CmsOutboundReport;
}
