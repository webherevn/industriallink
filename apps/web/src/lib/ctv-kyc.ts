import type {
  CrmKycProfileView,
  CrmKycReviewListView,
  CrmKycReviewResultView,
  CrmKycSide,
  CrmKycUploadResult,
  ReviewCrmKycRequest,
  UpdateCrmKycRequest,
} from '@industriallink/contracts';
import { apiRequest, getApiBase, tokenStore } from '@/lib/api';

/** Hồ sơ xác thực CCCD & ngân hàng của CTV đang đăng nhập. */
export function fetchMyKyc(): Promise<CrmKycProfileView> {
  return apiRequest<CrmKycProfileView>('/ctv/kyc');
}

/** Lưu hồ sơ xác thực. Cần đủ 2 ảnh CCCD và số CCCD 12 chữ số. */
export function saveMyKyc(body: UpdateCrmKycRequest): Promise<CrmKycProfileView> {
  return apiRequest<CrmKycProfileView>('/ctv/kyc', { method: 'PUT', body });
}

/** Tải 1 mặt ảnh CCCD. Ảnh lưu ở kho private, không có URL công khai. */
export function uploadKycImage(
  side: CrmKycSide,
  file: File,
): Promise<CrmKycUploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<CrmKycUploadResult>(`/ctv/kyc/upload?side=${side}`, {
    method: 'POST',
    body: form,
    isForm: true,
  });
}

/**
 * URL ảnh CCCD có kèm token (vì endpoint private).
 * Dùng thẻ <img> sẽ không gửi Authorization header — cần fetch blob.
 */
export async function fetchKycImageBlob(partnerId: string, side: CrmKycSide): Promise<string> {
  const res = await fetch(
    `${getApiBase()}/ctv/kyc/image/${partnerId}/${side}`,
    {
      headers: authHeaders(),
      credentials: 'include',
    },
  );
  if (!res.ok) throw new Error('Không tải được ảnh CCCD');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Danh sách hồ sơ KYC cho CRM Admin duyệt. */
export function fetchCrmKycList(params: {
  status?: string;
  query?: string;
}): Promise<CrmKycReviewListView> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.query) query.set('query', params.query);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<CrmKycReviewListView>(`/crm/ctv/kyc${suffix}`);
}

/** Duyệt hoặc từ chối hồ sơ KYC. */
export function reviewCrmKyc(
  partnerId: string,
  body: ReviewCrmKycRequest,
): Promise<CrmKycReviewResultView> {
  return apiRequest<CrmKycReviewResultView>(`/crm/ctv/kyc/${partnerId}/review`, {
    method: 'PATCH',
    body,
  });
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
