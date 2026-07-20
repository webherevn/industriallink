export type CvTemplateCategory = 'all' | 'modern' | 'professional' | 'creative' | 'minimal';

export interface CvTemplate {
  id: string;
  name: string;
  category: Exclude<CvTemplateCategory, 'all'>;
  accent: string;
  layout: 'sidebar' | 'classic' | 'split';
}

export const CV_TEMPLATE_FILTERS: { id: CvTemplateCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả mẫu' },
  { id: 'modern', label: 'Hiện đại' },
  { id: 'professional', label: 'Chuyên nghiệp' },
  { id: 'creative', label: 'Sáng tạo' },
  { id: 'minimal', label: 'Tối giản' },
];

export const CV_TEMPLATES: CvTemplate[] = [
  { id: 'modern-01', name: 'Hiện đại 01', category: 'modern', accent: '#072348', layout: 'sidebar' },
  { id: 'modern-02', name: 'Hiện đại 02', category: 'modern', accent: '#0ea5e9', layout: 'split' },
  { id: 'pro-01', name: 'Chuyên nghiệp 01', category: 'professional', accent: '#1e3a5f', layout: 'classic' },
  { id: 'pro-02', name: 'Chuyên nghiệp 02', category: 'professional', accent: '#334155', layout: 'sidebar' },
  { id: 'creative-01', name: 'Sáng tạo 01', category: 'creative', accent: '#7c3aed', layout: 'split' },
  { id: 'minimal-01', name: 'Tối giản 01', category: 'minimal', accent: '#0f172a', layout: 'classic' },
];

/** Luồng Tạo CV bằng AI: nhập text → chọn mẫu → tải xuống. */
export const CV_CREATE_STEPS = [
  { id: 1, label: 'Nhập & AI phân tích' },
  { id: 2, label: 'Chọn mẫu CV' },
  { id: 3, label: 'Xem trước & Tải xuống' },
] as const;

export interface CvDraft {
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
