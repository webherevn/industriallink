import type {
  CmsCategoryView,
  CmsPostListItem,
  CmsPostView,
  CmsContentType,
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

export async function fetchPublishedCmsPosts(params: {
  type?: CmsContentType;
  category?: string;
  limit?: number;
} = {}): Promise<CmsPostListItem[]> {
  const qs = new URLSearchParams();
  qs.set('type', params.type ?? CmsType.Post);
  if (params.category) qs.set('category', params.category);
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${apiPublicBase()}/cms/posts?${qs}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  return (await res.json()) as CmsPostListItem[];
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
