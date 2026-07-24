import type {
  CandidateView,
  CvDraftFromTextResponse,
  CvDraftView,
  ResumeParseStatusResponse,
  ResumeUploadResponse,
  SaveCvDraftToProfileResponse,
  UpdateCandidateProfileRequest,
  UpdateCandidateProfileResponse,
  UploadAvatarResponse,
} from '@industriallink/contracts';
import { apiRequest, getApiBase, tokenStore } from './api';

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/candidates/me/resumes', { method: 'POST', body: form, isForm: true });
}

export async function getResumeStatus(resumeId: string): Promise<ResumeParseStatusResponse> {
  return apiRequest(`/candidates/me/resumes/${resumeId}/status`);
}

export async function getMyCandidate(): Promise<CandidateView> {
  return apiRequest('/candidates/me');
}

/** Cập nhật toàn bộ hồ sơ ứng viên (trang Chỉnh sửa hồ sơ). */
export async function updateMyProfile(
  body: UpdateCandidateProfileRequest,
): Promise<UpdateCandidateProfileResponse> {
  return apiRequest('/candidates/me', { method: 'PATCH', body });
}

/** Hồ sơ ứng viên cho NTD xem từ Search / Matching. */
export async function getCandidateById(candidateId: string): Promise<CandidateView> {
  return apiRequest(`/candidates/${candidateId}`);
}

export async function uploadAvatar(file: File): Promise<UploadAvatarResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/candidates/me/avatar', { method: 'POST', body: form, isForm: true });
}

/** AI trích xuất bản nháp CV từ văn bản tự do + gợi ý trường thiếu. */
export async function draftCvFromText(text: string): Promise<CvDraftFromTextResponse> {
  return apiRequest('/candidates/me/cv-draft/from-text', {
    method: 'POST',
    body: { text },
  });
}

/** Upload file CV → AI trích xuất + gợi ý trường thiếu (cùng response với from-text). */
export async function draftCvFromFile(file: File): Promise<CvDraftFromTextResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/candidates/me/cv-draft/from-file', {
    method: 'POST',
    body: form,
    isForm: true,
  });
}

/** Lưu bản nháp CV vào hồ sơ ứng viên (tuỳ chọn từ wizard). */
export async function saveCvDraftToProfile(
  draft: CvDraftView,
): Promise<SaveCvDraftToProfileResponse> {
  return apiRequest('/candidates/me/cv-draft/save', {
    method: 'POST',
    body: { draft },
  });
}

/** Tải ảnh đại diện đã upload (cần Bearer) → blob URL. */
export async function fetchMyAvatarObjectUrl(): Promise<string | null> {
  const token = tokenStore.get();
  if (!token) return null;
  const res = await fetch(`${getApiBase()}/candidates/me/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
