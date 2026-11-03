/** Khối «AI Matching hoạt động như thế nào» trên trang chủ. */

export const HOMEPAGE_STEP_ICONS = ['profile', 'list', 'link', 'chat'] as const;
export type HomepageStepIcon = (typeof HOMEPAGE_STEP_ICONS)[number];

export interface HomepageStepItem {
  title: string;
  description: string;
  /** Icon có sẵn. Ảnh imageUrl, nếu có, thay icon này. */
  icon: HomepageStepIcon;
  imageUrl: string;
}

export interface HomepageStepsContent {
  /** Cụm titleAccent được gạch chân cam, căn giữa dưới đúng cụm đó. */
  title: string;
  titleAccent: string;
  subtitle: string;
  items: HomepageStepItem[];
}

export const DEFAULT_HOMEPAGE_STEPS: HomepageStepsContent = {
  title: 'AI Matching hoạt động như thế nào?',
  titleAccent: 'Matching',
  subtitle: 'Đơn giản – minh bạch – hiệu quả cho cả hai phía',
  items: [
    {
      title: 'Tạo hồ sơ / vị trí',
      description: 'Doanh nghiệp đăng vị trí tuyển dụng, ứng viên tạo hồ sơ năng lực.',
      icon: 'profile',
      imageUrl: '',
    },
    {
      title: 'AI phân tích & gợi ý',
      description: 'Hệ thống phân tích yêu cầu và hồ sơ, gợi ý những kết nối phù hợp kèm điểm %.',
      icon: 'list',
      imageUrl: '',
    },
    {
      title: 'Đồng ý kết nối',
      description: 'Hai bên xem thông tin và đồng ý kết nối nếu quan tâm.',
      icon: 'link',
      imageUrl: '',
    },
    {
      title: 'Chat trực tiếp miễn phí',
      description: 'Khi cả hai đồng ý, bạn có thể chat trực tiếp để trao đổi chi tiết và tiến tới phỏng vấn.',
      icon: 'chat',
      imageUrl: '',
    },
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

function iconOf(value: unknown, fallback: HomepageStepIcon): HomepageStepIcon {
  const raw = clip(value, 20);
  return (HOMEPAGE_STEP_ICONS as readonly string[]).includes(raw) ? (raw as HomepageStepIcon) : fallback;
}

function itemOf(value: unknown, fallback: HomepageStepItem): HomepageStepItem {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageStepItem>) : {};
  return {
    title: clip(row.title, 80),
    description: clip(row.description, 280),
    icon: iconOf(row.icon, fallback.icon),
    imageUrl: assetUrl(row.imageUrl),
  };
}

function copyDefaults(): HomepageStepsContent {
  return {
    ...DEFAULT_HOMEPAGE_STEPS,
    items: DEFAULT_HOMEPAGE_STEPS.items.map((item) => ({ ...item })),
  };
}

/** Luôn đủ 4 bước. Thiếu dữ liệu thì dùng mẫu. */
export function normalizeHomepageSteps(input: unknown): HomepageStepsContent {
  if (input == null || typeof input !== 'object') return copyDefaults();
  const row = input as Partial<HomepageStepsContent>;
  const base = DEFAULT_HOMEPAGE_STEPS;
  const source = Array.isArray(row.items) ? row.items : [];
  return {
    title: clip(row.title, 140) || base.title,
    titleAccent: clip(row.titleAccent, 40),
    subtitle: clip(row.subtitle, 240) || base.subtitle,
    items: base.items.map((fallback, index) =>
      source[index] == null ? { ...fallback } : itemOf(source[index], fallback),
    ),
  };
}
