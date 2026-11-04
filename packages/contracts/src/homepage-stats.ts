/** Thanh số liệu trên trang chủ, ngay dưới khối cách hoạt động. */

export const HOMEPAGE_STAT_ICONS = ['people', 'building', 'badge', 'check'] as const;
export type HomepageStatIcon = (typeof HOMEPAGE_STAT_ICONS)[number];

export interface HomepageStatItem {
  /** Dòng đậm. Có thể là số («50.000+») hoặc câu ngắn. */
  value: string;
  /** Dòng nhỏ phía dưới. */
  label: string;
  /** Icon có sẵn. Ảnh imageUrl, nếu có, thay icon này. */
  icon: HomepageStatIcon;
  imageUrl: string;
}

export interface HomepageStatsContent {
  items: HomepageStatItem[];
}

export const DEFAULT_HOMEPAGE_STATS: HomepageStatsContent = {
  items: [
    { value: '50.000+', label: 'Ứng viên tiềm năng', icon: 'people', imageUrl: '' },
    { value: '3.000+', label: 'Doanh nghiệp đang tuyển', icon: 'building', imageUrl: '' },
    { value: '20+', label: 'Nhóm ngành công nghiệp', icon: 'badge', imageUrl: '' },
    { value: 'Kết nối nhanh hơn', label: 'với AI Matching', icon: 'check', imageUrl: '' },
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

function iconOf(value: unknown, fallback: HomepageStatIcon): HomepageStatIcon {
  const raw = clip(value, 20);
  return (HOMEPAGE_STAT_ICONS as readonly string[]).includes(raw) ? (raw as HomepageStatIcon) : fallback;
}

function itemOf(value: unknown, fallback: HomepageStatItem): HomepageStatItem {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageStatItem>) : {};
  return {
    value: clip(row.value, 48),
    label: clip(row.label, 80),
    icon: iconOf(row.icon, fallback.icon),
    imageUrl: assetUrl(row.imageUrl),
  };
}

function copyDefaults(): HomepageStatsContent {
  return { items: DEFAULT_HOMEPAGE_STATS.items.map((item) => ({ ...item })) };
}

/** Luôn đủ 4 ô. Thiếu dữ liệu thì dùng mẫu. */
export function normalizeHomepageStats(input: unknown): HomepageStatsContent {
  if (input == null || typeof input !== 'object') return copyDefaults();
  const row = input as Partial<HomepageStatsContent>;
  const source = Array.isArray(row.items) ? row.items : [];
  return {
    items: DEFAULT_HOMEPAGE_STATS.items.map((fallback, index) =>
      source[index] == null ? { ...fallback } : itemOf(source[index], fallback),
    ),
  };
}
