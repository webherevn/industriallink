import { apiRequest } from './api';

export interface GenerateCoverLetterRequest {
  jobId?: string;
  targetRole?: string;
  targetCompany?: string;
  tone?: 'pro' | 'enthusiastic' | 'concise';
  focus?: 'balanced' | 'sales_kpi' | 'technical';
}

export async function generateAiCoverLetter(
  input: GenerateCoverLetterRequest,
): Promise<{ content: string; usedAi: boolean }> {
  return apiRequest('/candidates/me/cover-letter/generate', {
    method: 'POST',
    body: input,
  });
}

const COVER_LETTER_STORAGE_KEY = 'inlink_cover_letters_v1';

interface CoverLetterStore {
  defaultContent?: string;
  byJobId?: Record<string, string>;
}

function readStore(): CoverLetterStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(COVER_LETTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CoverLetterStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCoverLetterForApply(content: string, jobId?: string | null): void {
  if (typeof window === 'undefined') return;
  const trimmed = content.trim();
  if (!trimmed) return;
  const store = readStore();
  if (jobId) {
    store.byJobId = { ...(store.byJobId ?? {}), [jobId]: trimmed };
  }
  store.defaultContent = trimmed;
  try {
    window.localStorage.setItem(COVER_LETTER_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

export function loadSavedCoverLetter(jobId?: string | null): {
  content: string | null;
  isJobSpecific: boolean;
} {
  const store = readStore();
  if (jobId && store.byJobId?.[jobId]) {
    return { content: store.byJobId[jobId], isJobSpecific: true };
  }
  if (store.defaultContent) {
    return { content: store.defaultContent, isJobSpecific: false };
  }
  return { content: null, isJobSpecific: false };
}
