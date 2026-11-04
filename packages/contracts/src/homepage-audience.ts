/** Khối «Dành cho ứng viên» trên trang chủ. */

export interface HomepageAudienceJob {
  title: string;
  company: string;
  location: string;
  /** Ví dụ 92%. */
  score: string;
  avatarUrl: string;
}

export interface HomepageAudienceContent {
  /** Dòng tiêu đề thứ nhất. */
  kicker: string;
  /** Dòng tiêu đề thứ hai. */
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  points: [string, string, string, string];
  /** Ảnh người bên phải. Trống thì dùng khung minh họa. */
  imageUrl: string;
  cardTitle: string;
  jobs: HomepageAudienceJob[];
}

export const DEFAULT_HOMEPAGE_AUDIENCE: HomepageAudienceContent = {
  kicker: 'Dành cho ứng viên',
  title: 'Để cơ hội phù hợp tìm đến bạn',
  subtitle:
    'Không cần nộp thật nhiều hồ sơ. AI sẽ gợi ý những công việc và nhà tuyển dụng phù hợp với năng lực, kinh nghiệm và định hướng nghề nghiệp của bạn.',
  ctaLabel: 'Tạo hồ sơ miễn phí',
  ctaHref: '/register',
  points: [
    'Nhận gợi ý công việc theo % phù hợp',
    'Khám phá nhà tuyển dụng phù hợp',
    'Chủ động kết nối và chat trực tiếp miễn phí',
    'Cập nhật cơ hội mới từ các doanh nghiệp uy tín',
  ],
  imageUrl: '',
  cardTitle: 'Công việc gợi ý cho bạn',
  jobs: [
    { title: 'Kỹ sư Bảo trì Cơ điện', company: 'Công ty Thành XV2', location: 'Hải Phòng', score: '92%', avatarUrl: '' },
    { title: 'Sales Kỹ thuật', company: 'Công ty ABC', location: 'Hà Nội', score: '88%', avatarUrl: '' },
    { title: 'Kỹ thuật viên Dịch vụ', company: 'Công ty DEF', location: 'Bắc Ninh', score: '76%', avatarUrl: '' },
  ],
};

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, max);
}

function assetUrl(value: unknown): string {
  const raw = clip(value, 500);
  if (!raw) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
}

function pageUrl(value: unknown, fallback: string): string {
  const raw = clip(value, 300);
  if (!raw) return fallback;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return fallback;
}

function scoreOf(value: unknown, fallback: string): string {
  const raw = clip(value, 8);
  return raw || fallback;
}

function jobOf(value: unknown, fallback: HomepageAudienceJob): HomepageAudienceJob {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageAudienceJob>) : {};
  return {
    title: clip(row.title, 80) || fallback.title,
    company: clip(row.company, 80) || fallback.company,
    location: clip(row.location, 60) || fallback.location,
    score: scoreOf(row.score, fallback.score),
    avatarUrl: assetUrl(row.avatarUrl),
  };
}

function copyDefaults(): HomepageAudienceContent {
  return {
    ...DEFAULT_HOMEPAGE_AUDIENCE,
    points: [...DEFAULT_HOMEPAGE_AUDIENCE.points] as [string, string, string, string],
    jobs: DEFAULT_HOMEPAGE_AUDIENCE.jobs.map((job) => ({ ...job })),
  };
}

/** Luôn đủ 4 dòng tích và 3 việc gợi ý. */
export function normalizeHomepageAudience(input: unknown): HomepageAudienceContent {
  if (input == null || typeof input !== 'object') return copyDefaults();
  const row = input as Partial<HomepageAudienceContent>;
  const base = DEFAULT_HOMEPAGE_AUDIENCE;
  const points = Array.isArray(row.points) ? row.points : [];
  const jobs = Array.isArray(row.jobs) ? row.jobs : [];
  return {
    kicker: clip(row.kicker, 80) || base.kicker,
    title: clip(row.title, 140) || base.title,
    subtitle: clip(row.subtitle, 400) || base.subtitle,
    ctaLabel: clip(row.ctaLabel, 60) || base.ctaLabel,
    ctaHref: pageUrl(row.ctaHref, base.ctaHref),
    points: [0, 1, 2, 3].map((index) => clip(points[index], 140) || base.points[index]) as [string, string, string, string],
    imageUrl: assetUrl(row.imageUrl),
    cardTitle: clip(row.cardTitle, 80) || base.cardTitle,
    jobs: base.jobs.map((fallback, index) => (jobs[index] == null ? { ...fallback } : jobOf(jobs[index], fallback))),
  };
}
