import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminUserView,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listAdminUsers(): Promise<AdminUserView[]> {
  return apiRequest('/admin/users');
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
