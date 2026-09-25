import type {
  CmsAuthorProfileView,
  CmsCategoryView,
  CmsContentType,
  CmsFooterSettingsView,
  CmsHomepageSettingsView,
  CmsPostListItem,
  CmsPostListPage,
  CmsPostView,
  CmsRedirectView,
} from '@industriallink/contracts';
import { CmsContentType as CmsType } from '@industriallink/contracts';
import { apiPublicBase } from './public-paths';

export async function fetchPublicCmsCategories(): Promise<CmsCategoryView[]> {
  const res = await fetch(`${apiPublicBase()}/cms/categories`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as CmsCategoryView[];
}

export async function fetchPublicCmsCategory(slug: string): Promise<CmsCategoryView | null> {
  const cats = await fetchPublicCmsCategories();
  return cats.find((c) => c.slug === slug) ?? null;
}

export async function fetchPublishedCmsPostsPage(params: {
  type?: CmsContentType;
  category?: string;
  author?: string;
  limit?: number;
  page?: number;
} = {}): Promise<CmsPostListPage> {
  const qs = new URLSearchParams();
  qs.set('type', params.type ?? CmsType.Post);
  if (params.category) qs.set('category', params.category);
  if (params.author) qs.set('author', params.author);
  if (params.limit) qs.set('limit', String(params.limit));
  qs.set('page', String(params.page ?? 1));
  const res = await fetch(`${apiPublicBase()}/cms/posts?${qs}`, {
    next: { revalidate: 30 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    return { items: [], total: 0, page: 1, pageSize: params.limit ?? 12, totalPages: 1 };
  }
  const data = (await res.json()) as CmsPostListPage | CmsPostListItem[];
  // Tương thích response cũ (mảng) nếu API chưa deploy
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length || 12,
      totalPages: 1,
    };
  }
  // Bảo vệ khi API lỗi shape / proxy trả HTML
  if (!data || !Array.isArray(data.items)) {
    return { items: [], total: 0, page: 1, pageSize: params.limit ?? 12, totalPages: 1 };
  }
  return data;
}

/** @deprecated Dùng fetchPublishedCmsPostsPage — giữ để sitemap/list đơn giản. */
export async function fetchPublishedCmsPosts(params: {
  type?: CmsContentType;
  category?: string;
  author?: string;
  limit?: number;
} = {}): Promise<CmsPostListItem[]> {
  const page = await fetchPublishedCmsPostsPage({ ...params, page: 1 });
  return page.items;
}

export async function fetchPublishedCmsPost(slug: string): Promise<CmsPostView | null> {
  const res = await fetch(`${apiPublicBase()}/cms/posts/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || !res.ok) return null;
  return (await res.json()) as CmsPostView;
}

export async function fetchPublishedCmsPage(slug: string): Promise<CmsPostView | null> {
  const res = await fetch(`${apiPublicBase()}/cms/pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || !res.ok) return null;
  return (await res.json()) as CmsPostView;
}

export async function fetchCmsRedirect(fromPath: string): Promise<CmsRedirectView | null> {
  const res = await fetch(
    `${apiPublicBase()}/cms/redirect?from=${encodeURIComponent(fromPath)}`,
    {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    },
  );
  if (res.status === 404 || !res.ok) return null;
  return (await res.json()) as CmsRedirectView;
}

export async function fetchPublicCmsAuthor(slug: string): Promise<CmsAuthorProfileView | null> {
  const res = await fetch(`${apiPublicBase()}/cms/authors/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404 || !res.ok) return null;
  return (await res.json()) as CmsAuthorProfileView;
}

export async function fetchPublicCmsAuthors(): Promise<CmsAuthorProfileView[]> {
  const res = await fetch(`${apiPublicBase()}/cms/authors`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as CmsAuthorProfileView[];
}

export async function fetchPublicCmsFooter(): Promise<CmsFooterSettingsView | null> {
  const res = await fetch(`${apiPublicBase()}/cms/footer`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as CmsFooterSettingsView;
}

export async function fetchPublicCmsHomepage(): Promise<CmsHomepageSettingsView | null> {
  const res = await fetch(`${apiPublicBase()}/cms/homepage`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as CmsHomepageSettingsView;
}

export async function fetchPublicCmsRobots(): Promise<
  import('@industriallink/contracts').CmsRobotsSettingsView | null
> {
  const res = await fetch(`${apiPublicBase()}/cms/robots`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as import('@industriallink/contracts').CmsRobotsSettingsView;
}

export async function fetchPublicCmsSiteCode(): Promise<
  import('@industriallink/contracts').CmsSiteCodeSettingsView | null
> {
  const res = await fetch(`${apiPublicBase()}/cms/site-code`, {
    next: { revalidate: 30 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as import('@industriallink/contracts').CmsSiteCodeSettingsView;
}
