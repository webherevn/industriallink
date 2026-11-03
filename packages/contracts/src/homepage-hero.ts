/** Banner hero trang chủ. SuperAdmin sửa chữ và ảnh; public chỉ đọc. */

export interface HomepageHeroPerson {
  name: string;
  /** Dòng phụ, xuống dòng bằng \\n. */
  detail: string;
  score: string;
  avatarUrl: string;
  tags: string[];
}

export interface HomepageHeroJob {
  title: string;
  company: string;
  location: string;
  score: string;
  iconUrl: string;
  tags: string[];
}

export interface HomepageHeroContent {
  eyebrow: string;
  /** Xuống dòng bằng \\n. Cụm titleAccent được tô cam. */
  title: string;
  titleAccent: string;
  subtitle: string;
  primaryLabel: string;
  primaryHint: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHint: string;
  secondaryHref: string;
  imageUrl: string;
  candidatesTitle: string;
  candidates: HomepageHeroPerson[];
  jobsTitle: string;
  jobs: HomepageHeroJob[];
}

export const DEFAULT_HOMEPAGE_HERO: HomepageHeroContent = {
  eyebrow: 'NỀN TẢNG AI MATCHING NHÂN LỰC CÔNG NGHIỆP',
  title: 'Kết nối đúng người,\nđúng công việc\nbằng AI Matching',
  titleAccent: 'AI Matching',
  subtitle:
    'Chủ động tìm và kết nối ứng viên – nhà tuyển dụng phù hợp với chấm điểm % phù hợp. Khi cả hai đồng ý, chat trực tiếp miễn phí, không phụ thuộc gói dịch vụ.',
  primaryLabel: 'Tôi cần tuyển người',
  primaryHint: 'Dành cho doanh nghiệp',
  primaryHref: '/register?role=recruiter',
  secondaryLabel: 'Tôi đang tìm việc',
  secondaryHint: 'Dành cho ứng viên',
  secondaryHref: '/viec-lam',
  imageUrl: '',
  candidatesTitle: 'Ứng viên phù hợp',
  candidates: [
    {
      name: 'Nguyễn Văn Minh',
      detail: 'Kỹ sư Cơ điện\n6 năm kinh nghiệm',
      score: '92%',
      avatarUrl: '',
      tags: ['5 năm kinh nghiệm', 'Bảo trì, vận hành'],
    },
    { name: 'Trần Quốc Dũng', detail: '', score: '87%', avatarUrl: '', tags: [] },
    { name: 'Lê Hoàng Nam', detail: '', score: '78%', avatarUrl: '', tags: [] },
  ],
  jobsTitle: 'Công việc phù hợp',
  jobs: [
    {
      title: 'Sales B2B Thiết bị công nghiệp',
      company: 'Công ty TNHH ABC',
      location: 'Hà Nội',
      score: '88%',
      iconUrl: '',
      tags: ['Thu nhập tốt', 'Cơ hội phát triển'],
    },
    {
      title: 'Kỹ sư Bảo trì Nhà máy',
      company: '',
      location: '',
      score: '78%',
      iconUrl: '',
      tags: [],
    },
    {
      title: 'Nhân viên Kinh doanh',
      company: '',
      location: '',
      score: '76%',
      iconUrl: '',
      tags: [],
    },
  ],
};

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, max);
}

function safeHref(value: unknown, fallback: string): string {
  const raw = clip(value, 300);
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return fallback;
}

function scoreOf(value: unknown): string {
  const raw = clip(value, 8);
  if (!raw) return '';
  if (/^\d{1,3}$/.test(raw)) return `${raw}%`;
  return raw;
}

function tagsOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => clip(item, 40))
    .filter(Boolean)
    .slice(0, 4);
}

function assetUrl(value: unknown): string {
  const raw = clip(value, 500);
  if (!raw) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function personOf(value: unknown): HomepageHeroPerson {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageHeroPerson>) : {};
  return {
    name: clip(row.name, 80),
    detail: clip(row.detail, 160),
    score: scoreOf(row.score),
    avatarUrl: assetUrl(row.avatarUrl),
    tags: tagsOf(row.tags),
  };
}

function jobOf(value: unknown): HomepageHeroJob {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageHeroJob>) : {};
  return {
    title: clip(row.title, 120),
    company: clip(row.company, 120),
    location: clip(row.location, 80),
    score: scoreOf(row.score),
    iconUrl: assetUrl(row.iconUrl),
    tags: tagsOf(row.tags),
  };
}

function padPeople(list: unknown): HomepageHeroPerson[] {
  const source = Array.isArray(list) ? list : null;
  if (!source) return DEFAULT_HOMEPAGE_HERO.candidates.map((item) => ({ ...item, tags: [...item.tags] }));
  return [0, 1, 2].map((index) => (source[index] == null ? personOf({}) : personOf(source[index])));
}

function padJobs(list: unknown): HomepageHeroJob[] {
  const source = Array.isArray(list) ? list : null;
  if (!source) return DEFAULT_HOMEPAGE_HERO.jobs.map((item) => ({ ...item, tags: [...item.tags] }));
  return [0, 1, 2].map((index) => (source[index] == null ? jobOf({}) : jobOf(source[index])));
}

/** Banner đủ 3 dòng ứng viên và 3 dòng việc. Thiếu dữ liệu thì dùng mẫu. */
export function normalizeHomepageHero(input: unknown): HomepageHeroContent {
  if (input == null || typeof input !== 'object') {
    return {
      ...DEFAULT_HOMEPAGE_HERO,
      candidates: DEFAULT_HOMEPAGE_HERO.candidates.map((item) => ({ ...item, tags: [...item.tags] })),
      jobs: DEFAULT_HOMEPAGE_HERO.jobs.map((item) => ({ ...item, tags: [...item.tags] })),
    };
  }
  const row = input as Partial<HomepageHeroContent>;
  const base = DEFAULT_HOMEPAGE_HERO;
  return {
    eyebrow: clip(row.eyebrow, 160) || base.eyebrow,
    title: clip(row.title, 240) || base.title,
    titleAccent: clip(row.titleAccent, 40),
    subtitle: clip(row.subtitle, 500) || base.subtitle,
    primaryLabel: clip(row.primaryLabel, 60) || base.primaryLabel,
    primaryHint: clip(row.primaryHint, 60) || base.primaryHint,
    primaryHref: safeHref(row.primaryHref, base.primaryHref),
    secondaryLabel: clip(row.secondaryLabel, 60) || base.secondaryLabel,
    secondaryHint: clip(row.secondaryHint, 60) || base.secondaryHint,
    secondaryHref: safeHref(row.secondaryHref, base.secondaryHref),
    imageUrl: assetUrl(row.imageUrl),
    candidatesTitle: clip(row.candidatesTitle, 80) || base.candidatesTitle,
    candidates: padPeople(row.candidates),
    jobsTitle: clip(row.jobsTitle, 80) || base.jobsTitle,
    jobs: padJobs(row.jobs),
  };
}
