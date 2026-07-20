/** Bản nháp CV do AI trích từ văn bản tự do (hoặc form chỉnh tay). */
export interface CvDraftView {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  softSkills: string[];
  experience: { role: string; company: string; period: string; bullets: string }[];
  education: { school: string; degree: string; period: string }[];
  certificates: string[];
  projects: { name: string; detail: string }[];
}

export interface CvDraftFieldHint {
  key: string;
  label: string;
  status: 'filled' | 'missing' | 'weak';
  value: string | null;
  /** Gợi ý bổ sung khi thiếu / yếu. */
  suggestion: string;
}

export interface CvDraftFromTextRequest {
  /** Nội dung ứng viên tự nhập (văn bản tự do). */
  text: string;
}

export interface CvDraftFromTextResponse {
  draft: CvDraftView;
  fields: CvDraftFieldHint[];
  missingCount: number;
  aiScore: number | null;
  message: string;
}
