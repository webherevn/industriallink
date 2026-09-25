import {
  CmsContentStatus,
  CmsContentType,
  type CmsCategoryView,
  type CmsPostListItem,
  type CmsPostView,
  type UpsertCmsCategoryRequest,
  type UpsertCmsPostRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchCmsOverview() {
  return apiRequest<{
    categories: number;
    posts: number;
    pages: number;
    publishedPosts: number;
    publishedPages: number;
    drafts: number;
  }>('/admin/cms/overview');
}

export async function listCmsCategories(): Promise<CmsCategoryView[]> {
  return apiRequest('/admin/cms/categories');
}

export async function createCmsCategory(body: UpsertCmsCategoryRequest): Promise<CmsCategoryView> {
  return apiRequest('/admin/cms/categories', { method: 'POST', body });
}

export async function updateCmsCategory(
  id: string,
  body: UpsertCmsCategoryRequest,
): Promise<CmsCategoryView> {
  return apiRequest(`/admin/cms/categories/${id}`, { method: 'PATCH', body });
}

export async function deleteCmsCategory(id: string): Promise<void> {
  await apiRequest(`/admin/cms/categories/${id}`, { method: 'DELETE' });
}

export async function listCmsPostsAdmin(params: {
  type?: CmsContentType;
  status?: CmsContentStatus;
  category?: string;
} = {}): Promise<CmsPostListItem[]> {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  if (params.category) qs.set('category', params.category);
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiRequest(`/admin/cms/posts${suffix}`);
}

export async function getCmsPostAdmin(id: string): Promise<CmsPostView> {
  return apiRequest(`/admin/cms/posts/${id}`);
}

export async function createCmsPost(body: UpsertCmsPostRequest): Promise<CmsPostView> {
  return apiRequest('/admin/cms/posts', { method: 'POST', body });
}

export async function updateCmsPost(id: string, body: UpsertCmsPostRequest): Promise<CmsPostView> {
  return apiRequest(`/admin/cms/posts/${id}`, { method: 'PATCH', body });
}

export async function setCmsPostStatus(id: string, status: CmsContentStatus): Promise<CmsPostView> {
  return apiRequest(`/admin/cms/posts/${id}/status`, { method: 'PATCH', body: { status } });
}

export async function deleteCmsPost(id: string): Promise<void> {
  await apiRequest(`/admin/cms/posts/${id}`, { method: 'DELETE' });
}
