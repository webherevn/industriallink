/** Khối «Vì sao chọn inlink» dưới danh sách việc làm. SuperAdmin sửa chữ và ảnh. */

export const HOMEPAGE_REASON_ICONS = ['people', 'chart', 'blocked', 'chat', 'factory'] as const;
export type HomepageReasonIcon = (typeof HOMEPAGE_REASON_ICONS)[number];

export interface HomepageReasonItem {
  title: string;
  description: string;
  /** Icon có sẵn. Ảnh imageUrl, nếu có, thay icon này. */
  icon: HomepageReasonIcon;
  imageUrl: string;
}

export interface HomepageReasonsContent {
  /** Cụm titleAccent được gạch chân cam. */
  title: string;
  titleAccent: string;
  subtitle: string;
  items: HomepageReasonItem[];
}

export const DEFAULT_HOMEPAGE_REASONS: HomepageReasonsContent = {
  title: 'Vì sao chọn inlink?',
  titleAccent: 'inlink',
  subtitle: 'Khác biệt rõ ràng để tuyển dụng và tìm việc hiệu quả hơn.',
  items: [
    {
      title: 'AI Matching hai chiều',
      description: 'Doanh nghiệp tìm ứng viên phù hợp, ứng viên tìm đúng cơ hội.',
      icon: 'people',
      imageUrl: '',
    },
    {
      title: 'Chấm điểm % phù hợp',
      description: 'Biết ngay mức độ phù hợp để ưu tiên những cơ hội đáng quan tâm.',
      icon: 'chart',
      imageUrl: '',
    },
    {
      title: 'Không cần mua lượt đăng tin',
      description: 'AI Matching hoạt động độc lập, không phụ thuộc quảng bá tin.',
      icon: 'blocked',
      imageUrl: '',
    },
    {
      title: 'Kết nối & chat trực tiếp miễn phí',
      description: 'Khi cả hai đồng ý kết nối, trò chuyện trực tiếp không mất phí.',
      icon: 'chat',
      imageUrl: '',
    },
    {
      title: 'Chuyên sâu nhân lực công nghiệp',
      description: 'Tập trung Sales B2B và nhân sự kỹ thuật công nghiệp.',
      icon: 'factory',
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

function iconOf(value: unknown, fallback: HomepageReasonIcon): HomepageReasonIcon {
  const raw = clip(value, 20);
  return (HOMEPAGE_REASON_ICONS as readonly string[]).includes(raw) ? (raw as HomepageReasonIcon) : fallback;
}

function itemOf(value: unknown, fallback: HomepageReasonItem): HomepageReasonItem {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageReasonItem>) : {};
  return {
    title: clip(row.title, 80),
    description: clip(row.description, 240),
    icon: iconOf(row.icon, fallback.icon),
    imageUrl: assetUrl(row.imageUrl),
  };
}

function copyDefaults(): HomepageReasonsContent {
  return {
    ...DEFAULT_HOMEPAGE_REASONS,
    items: DEFAULT_HOMEPAGE_REASONS.items.map((item) => ({ ...item })),
  };
}

/** Luôn đủ 5 ý. Thiếu dữ liệu thì dùng mẫu. */
export function normalizeHomepageReasons(input: unknown): HomepageReasonsContent {
  if (input == null || typeof input !== 'object') return copyDefaults();
  const row = input as Partial<HomepageReasonsContent>;
  const base = DEFAULT_HOMEPAGE_REASONS;
  const source = Array.isArray(row.items) ? row.items : [];
  return {
    title: clip(row.title, 120) || base.title,
    titleAccent: clip(row.titleAccent, 40),
    subtitle: clip(row.subtitle, 240) || base.subtitle,
    items: base.items.map((fallback, index) =>
      source[index] == null ? { ...fallback } : itemOf(source[index], fallback),
    ),
  };
}
