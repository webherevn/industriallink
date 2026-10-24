import type {
  CompanyBrandProfile,
  CompanyMemberView,
  CompanyPublicProfileView,
  CompanyVerificationView,
  CompanyView,
  CreateCompanyRequest,
  InviteCompanyMemberRequest,
  SubmitCompanyVerificationRequest,
  UpdateCompanyBrandRequest,
  UpdateCompanyRequest,
  UploadCompanyLogoResponse,
} from '@industriallink/contracts';
import { ApiError, apiRequest, asArray, getApiBase, tokenStore } from './api';

export const COMPANY_PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function assertCompanyPhoto(file: File): void {
  const extOk = /\.(jpe?g|png|webp)$/i.test(file.name);
  const type = file.type.toLowerCase();
  const typeOk =
    !type ||
    type === 'application/octet-stream' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/pjpeg' ||
    type === 'image/png' ||
    type === 'image/webp';
  if (!extOk || !typeOk) {
    throw new ApiError(400, 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP');
  }
}

export const MY_COMPANY_LOGO_QUERY_KEY = ['my-company-logo'] as const;

export async function getMyCompany(): Promise<CompanyView> {
  return apiRequest('/companies/me');
}

export async function getMyCompanyVerification(): Promise<CompanyVerificationView> {
  return apiRequest('/companies/me/verification');
}

export async function submitCompanyVerification(
  body: SubmitCompanyVerificationRequest,
): Promise<CompanyVerificationView> {
  return apiRequest('/companies/me/verification', { method: 'POST', body });
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
  assertCompanyPhoto(file);
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/companies/me/logo', { method: 'POST', body: form, isForm: true });
}

export async function updateCompanyBrand(
  input: UpdateCompanyBrandRequest,
): Promise<CompanyBrandProfile> {
  return apiRequest('/companies/me/brand', { method: 'PATCH', body: input });
}

export async function uploadCompanyBanner(file: File): Promise<CompanyBrandProfile> {
  assertCompanyPhoto(file);
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/companies/me/banner', { method: 'POST', body: form, isForm: true });
}

export async function deleteCompanyBanner(): Promise<CompanyBrandProfile> {
  return apiRequest('/companies/me/banner', { method: 'DELETE' });
}

export async function uploadCompanyCulture(
  file: File,
  title: string,
  caption: string,
): Promise<CompanyBrandProfile> {
  assertCompanyPhoto(file);
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  if (caption.trim()) form.append('caption', caption);
  return apiRequest('/companies/me/culture', { method: 'POST', body: form, isForm: true });
}

export async function deleteCompanyCulture(itemId: string): Promise<CompanyBrandProfile> {
  return apiRequest(`/companies/me/culture/${itemId}`, { method: 'DELETE' });
}

/** Ảnh công ty lưu dạng đường dẫn API, hoặc URL ngoài. */
export function companyMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
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
  return asArray(await apiRequest('/companies/me/members'));
}

export async function inviteCompanyMember(
  input: InviteCompanyMemberRequest,
): Promise<CompanyMemberView> {
  return apiRequest('/companies/me/members/invite', { method: 'POST', body: input });
}

export async function removeCompanyMember(memberId: string): Promise<{ message: string }> {
  return apiRequest(`/companies/me/members/${memberId}`, { method: 'DELETE' });
}
