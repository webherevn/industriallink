import type {
  CompanyMemberView,
  CompanyPublicProfileView,
  CompanyView,
  CreateCompanyRequest,
  InviteCompanyMemberRequest,
  UpdateCompanyRequest,
  UploadCompanyLogoResponse,
} from '@industriallink/contracts';
import { apiRequest, getApiBase, tokenStore } from './api';

export const MY_COMPANY_LOGO_QUERY_KEY = ['my-company-logo'] as const;

export async function getMyCompany(): Promise<CompanyView> {
  return apiRequest('/companies/me');
}

export async function getCompanyPublicProfile(id: string): Promise<CompanyPublicProfileView> {
  return apiRequest(`/companies/${id}/profile`);
}

export async function createCompany(input: CreateCompanyRequest): Promise<CompanyView> {
  return apiRequest('/companies', { method: 'POST', body: input });
}

export async function updateMyCompany(input: UpdateCompanyRequest): Promise<CompanyView> {
  return apiRequest('/companies/me', { method: 'PATCH', body: input });
}

export async function uploadCompanyLogo(file: File): Promise<UploadCompanyLogoResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/companies/me/logo', { method: 'POST', body: form, isForm: true });
}

/** Tải logo công ty (Bearer) → blob URL. */
export async function fetchMyCompanyLogoObjectUrl(): Promise<string | null> {
  const token = tokenStore.get();
  if (!token) return null;
  const res = await fetch(`${getApiBase()}/companies/me/logo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function listCompanyMembers(): Promise<CompanyMemberView[]> {
  return apiRequest('/companies/me/members');
}

export async function inviteCompanyMember(
  input: InviteCompanyMemberRequest,
): Promise<CompanyMemberView> {
  return apiRequest('/companies/me/members/invite', { method: 'POST', body: input });
}

export async function removeCompanyMember(memberId: string): Promise<{ message: string }> {
  return apiRequest(`/companies/me/members/${memberId}`, { method: 'DELETE' });
}
