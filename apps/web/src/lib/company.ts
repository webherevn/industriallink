import type {
  CompanyMemberView,
  CompanyPublicProfileView,
  CompanyView,
  CreateCompanyRequest,
  InviteCompanyMemberRequest,
  UpdateCompanyRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

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
