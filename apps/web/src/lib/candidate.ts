import type {
  CandidateView,
  CvDraftFromTextResponse,
  ResumeParseStatusResponse,
  ResumeUploadResponse,
  UploadAvatarResponse,
} from '@industriallink/contracts';
import { apiRequest, tokenStore } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1`
  : '/api/v1';

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

/** Tải ảnh đại diện đã upload (cần Bearer) → blob URL. */
export async function fetchMyAvatarObjectUrl(): Promise<string | null> {
  const token = tokenStore.get();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/candidates/me/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
