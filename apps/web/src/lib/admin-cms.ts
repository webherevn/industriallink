import {
  CmsContentStatus,
  CmsContentType,
  type CmsCategoryView,
  type CmsPostListItem,
  type CmsPostView,
  type CmsSeoOverview,
  type UpsertCmsCategoryRequest,
  type UpsertCmsPostRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function fetchCmsOverview(): Promise<CmsSeoOverview> {
  return apiRequest<CmsSeoOverview>('/admin/cms/overview');
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

export async function listCmsRedirects() {
  return apiRequest<
    {
      id: string;
      fromPath: string;
      toPath: string;
      statusCode: number;
      note: string | null;
      createdAt: string;
      updatedAt: string;
    }[]
  >('/admin/cms/redirects');
}

export async function upsertCmsRedirect(body: {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  note?: string | null;
}) {
  return apiRequest('/admin/cms/redirects', { method: 'POST', body });
}

export async function deleteCmsRedirect(id: string): Promise<void> {
  await apiRequest(`/admin/cms/redirects/${id}`, { method: 'DELETE' });
}

export async function uploadCmsMedia(file: File): Promise<{
  url: string;
  filename: string;
  mime: string;
  size: number;
}> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/cms/media', { method: 'POST', body: form, isForm: true });
}

export async function getCmsMenuAdmin(location: string) {
  return apiRequest<import('@industriallink/contracts').CmsMenuView>(
    `/admin/cms/menus/${encodeURIComponent(location)}`,
  );
}

export async function saveCmsMenuAdmin(
  location: string,
  body: import('@industriallink/contracts').SaveCmsMenuRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsMenuView>(
    `/admin/cms/menus/${encodeURIComponent(location)}`,
    { method: 'PUT', body },
  );
}

export async function getCmsFooterAdmin() {
  return apiRequest<import('@industriallink/contracts').CmsFooterSettingsView>('/admin/cms/footer');
}

export async function saveCmsFooterAdmin(
  body: import('@industriallink/contracts').UpsertCmsFooterSettingsRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsFooterSettingsView>('/admin/cms/footer', {
    method: 'PUT',
    body,
  });
}

export async function getCmsHomepageAdmin() {
  return apiRequest<import('@industriallink/contracts').CmsHomepageSettingsView>(
    '/admin/cms/homepage',
  );
}

export async function saveCmsHomepageAdmin(
  body: import('@industriallink/contracts').UpsertCmsHomepageSettingsRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsHomepageSettingsView>(
    '/admin/cms/homepage',
    { method: 'PUT', body },
  );
}

export async function getCmsRobotsAdmin() {
  return apiRequest<import('@industriallink/contracts').CmsRobotsSettingsView>(
    '/admin/cms/robots',
  );
}

export async function saveCmsRobotsAdmin(
  body: import('@industriallink/contracts').UpsertCmsRobotsSettingsRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsRobotsSettingsView>(
    '/admin/cms/robots',
    { method: 'PUT', body },
  );
}

export async function deleteCmsRobotsAdmin() {
  return apiRequest<import('@industriallink/contracts').CmsRobotsSettingsView>(
    '/admin/cms/robots',
    { method: 'DELETE' },
  );
}

export async function getCmsSiteCodeAdmin() {
  return apiRequest<import('@industriallink/contracts').CmsSiteCodeSettingsView>(
    '/admin/cms/site-code',
  );
}

export async function saveCmsSiteCodeAdmin(
  body: import('@industriallink/contracts').UpsertCmsSiteCodeSettingsRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsSiteCodeSettingsView>(
    '/admin/cms/site-code',
    { method: 'PUT', body },
  );
}

export async function getCmsAuthorProfile() {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView>(
    '/admin/cms/author-profile',
  );
}

export async function updateCmsAuthorProfile(
  body: import('@industriallink/contracts').UpsertCmsAuthorProfileRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView>(
    '/admin/cms/author-profile',
    { method: 'PUT', body },
  );
}

export async function listCmsAuthorProfiles() {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView[]>(
    '/admin/cms/author-profiles',
  );
}

export async function listEligibleAuthorUsers() {
  return apiRequest<Array<{ id: string; email: string; displayName: string; role: string }>>(
    '/admin/cms/author-profiles/eligible-users',
  );
}

export async function getCmsAuthorProfileByUser(userId: string) {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView>(
    `/admin/cms/author-profiles/${encodeURIComponent(userId)}`,
  );
}

export async function assignCmsAuthorProfile(
  body: import('@industriallink/contracts').AssignCmsAuthorProfileRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView>(
    '/admin/cms/author-profiles',
    { method: 'POST', body },
  );
}

export async function updateCmsAuthorProfileByUser(
  userId: string,
  body: import('@industriallink/contracts').UpsertCmsAuthorProfileRequest,
) {
  return apiRequest<import('@industriallink/contracts').CmsAuthorProfileView>(
    `/admin/cms/author-profiles/${encodeURIComponent(userId)}`,
    { method: 'PUT', body },
  );
}
