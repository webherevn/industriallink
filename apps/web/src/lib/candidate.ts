import type {
  CandidateExperienceView,
  CandidateSalesProfileView,
  CandidateView,
  ConnectionView,
  CvDraftExperienceView,
  CvDraftFromTextResponse,
  CvDraftView,
  RecruiterCandidateView,
  ResumeParseStatusResponse,
  ResumeUploadResponse,
  SaveCvDraftToProfileResponse,
  UpdateCandidateProfileRequest,
  UpdateCandidateProfileResponse,
  UploadAvatarResponse,
} from '@industriallink/contracts';
import { apiRequest, asArray, getApiBase, tokenStore } from './api';

function normalizeExperience(exp: CandidateExperienceView): CandidateExperienceView {
  return {
    ...exp,
    industries: asArray(exp?.industries),
    productsSold: asArray(exp?.productsSold),
    customerSegments: asArray(exp?.customerSegments),
    marketsCovered: asArray(exp?.marketsCovered),
    sellingStages: asArray(exp?.sellingStages),
    brandsTechnologies: asArray(exp?.brandsTechnologies),
    missingFields: asArray(exp?.missingFields),
  };
}

function normalizeSales(
  sales: CandidateSalesProfileView | null | undefined,
): CandidateSalesProfileView | null {
  if (!sales) return null;
  return {
    ...sales,
    productsSold: asArray(sales.productsSold),
    customerSegments: asArray(sales.customerSegments),
    marketsCovered: asArray(sales.marketsCovered),
    sellingStages: asArray(sales.sellingStages),
    languages: asArray(sales.languages),
    languageSkills: asArray(sales.languageSkills),
    desiredPositions: asArray(sales.desiredPositions),
    desiredLocations: asArray(sales.desiredLocations),
    careerMotivations: asArray(sales.careerMotivations),
    workStyles: asArray(sales.workStyles),
    careerOrientations: asArray(sales.careerOrientations),
  };
}

function normalizeCandidate<T extends CandidateView>(raw: T): T {
  const profile = raw?.profile;
  return {
    ...raw,
    skills: asArray(raw?.skills),
    experiences: asArray<CandidateExperienceView>(raw?.experiences).map(normalizeExperience),
    aiProfile: raw?.aiProfile
      ? {
          ...raw.aiProfile,
          strengths: asArray(raw.aiProfile.strengths),
          weaknesses: asArray(raw.aiProfile.weaknesses),
        }
      : null,
    profile: profile
      ? {
          ...profile,
          industriesExperienced: asArray(profile.industriesExperienced),
          certificates: asArray(profile.certificates),
          hobbies: asArray(profile.hobbies),
          brandsTechnologies: asArray(profile.brandsTechnologies),
          technicalWorkTypes: asArray(profile.technicalWorkTypes),
          technicalTools: asArray(profile.technicalTools),
          documentLiteracy: asArray(profile.documentLiteracy),
          desiredWorkEnvironments: asArray(profile.desiredWorkEnvironments),
          sales: normalizeSales(profile.sales),
        }
      : null,
  };
}

function normalizeCvDraft(draft: CvDraftView | null | undefined): CvDraftView {
  const source = draft ?? ({} as CvDraftView);
  const experience = asArray<CvDraftExperienceView>(source.experience).map((exp) => ({
    ...exp,
    industries: asArray<string>(exp?.industries),
    productsSold: asArray<string>(exp?.productsSold),
    customerSegments: asArray<string>(exp?.customerSegments),
    marketsCovered: asArray<string>(exp?.marketsCovered),
    sellingStages: asArray<string>(exp?.sellingStages),
    brandsTechnologies: asArray<string>(exp?.brandsTechnologies),
  }));
  return {
    ...source,
    skills: asArray(source.skills),
    softSkills: asArray(source.softSkills),
    languages: asArray(source.languages),
    languageSkills: asArray(source.languageSkills),
    hobbies: asArray(source.hobbies),
    productsSold: asArray(source.productsSold),
    customerSegments: asArray(source.customerSegments),
    marketsCovered: asArray(source.marketsCovered),
    industriesExperienced: asArray(source.industriesExperienced),
    desiredPositions: asArray(source.desiredPositions),
    desiredLocations: asArray(source.desiredLocations),
    careerMotivations: asArray(source.careerMotivations),
    careerOrientations: asArray(source.careerOrientations),
    workStyles: asArray(source.workStyles),
    brandsTechnologies: asArray(source.brandsTechnologies),
    technicalWorkTypes: asArray(source.technicalWorkTypes),
    technicalTools: asArray(source.technicalTools),
    documentLiteracy: asArray(source.documentLiteracy),
    desiredWorkEnvironments: asArray(source.desiredWorkEnvironments),
    certificates: asArray(source.certificates),
    experience,
    education: asArray(source.education),
    projects: asArray(source.projects),
  };
}

function normalizeCvResponse(res: CvDraftFromTextResponse): CvDraftFromTextResponse {
  return {
    ...res,
    draft: normalizeCvDraft(res?.draft),
    fields: asArray(res?.fields),
  };
}

export async function uploadResume(file: File): Promise<ResumeUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/candidates/me/resumes', { method: 'POST', body: form, isForm: true });
}

export async function getResumeStatus(resumeId: string): Promise<ResumeParseStatusResponse> {
  return apiRequest(`/candidates/me/resumes/${resumeId}/status`);
}

export async function getMyCandidate(): Promise<CandidateView> {
  return normalizeCandidate(await apiRequest<CandidateView>('/candidates/me'));
}

/** Cập nhật toàn bộ hồ sơ ứng viên (trang Chỉnh sửa hồ sơ). */
export async function updateMyProfile(
  body: UpdateCandidateProfileRequest,
): Promise<UpdateCandidateProfileResponse> {
  return apiRequest('/candidates/me', { method: 'PATCH', body });
}

/** Hồ sơ ứng viên cho NTD xem từ Search / Matching (liên hệ có thể bị ẩn). */
export async function getCandidateById(candidateId: string): Promise<RecruiterCandidateView> {
  return normalizeCandidate(await apiRequest<RecruiterCandidateView>(`/candidates/${candidateId}`));
}

export async function requestCandidateConnection(
  candidateId: string,
  message?: string,
): Promise<ConnectionView> {
  return apiRequest(`/candidates/${candidateId}/connection`, {
    method: 'POST',
    body: message ? { message } : {},
  });
}

export async function cancelCandidateConnection(
  candidateId: string,
): Promise<ConnectionView> {
  return apiRequest(`/candidates/${candidateId}/connection/cancel`, { method: 'POST' });
}

export async function listMyConnections(): Promise<ConnectionView[]> {
  return asArray(await apiRequest('/candidates/me/connections'));
}

export async function acceptConnection(connectionId: string): Promise<ConnectionView> {
  return apiRequest(`/candidates/me/connections/${connectionId}/accept`, { method: 'POST' });
}

export async function rejectConnection(connectionId: string): Promise<ConnectionView> {
  return apiRequest(`/candidates/me/connections/${connectionId}/reject`, { method: 'POST' });
}

export async function addCandidateShortlist(
  candidateId: string,
): Promise<{ ok: true; isShortlisted: true }> {
  return apiRequest(`/candidates/${candidateId}/shortlist`, { method: 'POST' });
}

export async function removeCandidateShortlist(
  candidateId: string,
): Promise<{ ok: true; isShortlisted: false }> {
  return apiRequest(`/candidates/${candidateId}/shortlist`, { method: 'DELETE' });
}

export async function uploadAvatar(file: File): Promise<UploadAvatarResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/candidates/me/avatar', { method: 'POST', body: form, isForm: true });
}

/** AI trích xuất bản nháp CV từ văn bản tự do + gợi ý trường thiếu. */
export async function draftCvFromText(text: string): Promise<CvDraftFromTextResponse> {
  return normalizeCvResponse(
    await apiRequest('/candidates/me/cv-draft/from-text', {
      method: 'POST',
      body: { text },
    }),
  );
}

/** Upload file CV → AI trích xuất + gợi ý trường thiếu (cùng response với from-text). */
export async function draftCvFromFile(file: File): Promise<CvDraftFromTextResponse> {
  const form = new FormData();
  form.append('file', file);
  return normalizeCvResponse(
    await apiRequest('/candidates/me/cv-draft/from-file', {
      method: 'POST',
      body: form,
      isForm: true,
    }),
  );
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
