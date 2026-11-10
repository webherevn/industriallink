import type {
  AdminCreateUserRequest,
  AdminSystemResetPreviewView,
  AdminSystemResetRequest,
  AdminSystemResetResultView,
  AdminUpdateUserRequest,
  AdminUserView,
} from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

export async function listAdminUsers(): Promise<AdminUserView[]> {
  return asArray(await apiRequest('/admin/users'));
}

export async function createAdminUser(body: AdminCreateUserRequest): Promise<AdminUserView> {
  return apiRequest('/admin/users', { method: 'POST', body });
}

export async function updateAdminUser(
  id: string,
  body: AdminUpdateUserRequest,
): Promise<AdminUserView> {
  return apiRequest(`/admin/users/${id}`, { method: 'PATCH', body });
}

export async function fetchSystemResetPreview(): Promise<AdminSystemResetPreviewView> {
  return apiRequest('/admin/users/system-reset/preview');
}

export async function executeSystemReset(
  body: AdminSystemResetRequest,
): Promise<AdminSystemResetResultView> {
  return apiRequest('/admin/users/system-reset', { method: 'POST', body });
}
