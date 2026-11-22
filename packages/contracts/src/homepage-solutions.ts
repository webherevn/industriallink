/** Khối «Giải pháp dành cho doanh nghiệp» trên trang chủ. */

export const HOMEPAGE_SOLUTION_ICONS = ['document', 'target', 'coins', 'building'] as const;
export type HomepageSolutionIcon = (typeof HOMEPAGE_SOLUTION_ICONS)[number];

export interface HomepageSolutionItem {
  title: string;
  description: string;
  /** Đúng 3 dòng có dấu tích xanh. */
  points: [string, string, string];
  /** Icon có sẵn. Ảnh imageUrl, nếu có, thay icon này. */
  icon: HomepageSolutionIcon;
  imageUrl: string;
  /** Đường dẫn nút mũi tên. Đường nội bộ bắt đầu bằng /. */
  href: string;
}

export interface HomepageSolutionsContent {
  title: string;
  titleAccent: string;
  subtitle: string;
  items: HomepageSolutionItem[];
}

export const DEFAULT_HOMEPAGE_SOLUTIONS: HomepageSolutionsContent = {
  title: 'Giải pháp dành cho doanh nghiệp',
  titleAccent: 'doanh nghiệp',
  subtitle: 'Chủ động tuyển dụng với các gói dịch vụ linh hoạt, không cần mua thêm lượt đẩy tin để sử dụng AI Matching.',
  items: [
    {
      title: 'Tin đăng',
      description: 'Đăng và quản lý vị trí tuyển dụng, khám phá ứng viên phù hợp.',
      points: ['Đăng tin tuyển dụng', 'Xem gợi ý ứng viên theo % phù hợp', 'Khai thác hồ sơ theo gói'],
      icon: 'document',
      imageUrl: '',
      href: 'https://tuyendung.inlink.vn/bang-gia#nentang',
    },
    {
      title: 'Tin săn',
      description: 'Chủ động tìm kiếm ứng viên cho vị trí khó hoặc chuyên môn cao.',
      points: ['Hỗ trợ xác định tiêu chí', 'Tìm kiếm và gợi ý ứng viên phù hợp', 'Báo cáo tiến độ (tùy gói)'],
      icon: 'target',
      imageUrl: '',
      href: 'https://tuyendung.inlink.vn/bang-gia#tinsan',
    },
    {
      title: 'Top-up Credit',
      description: 'Mua thêm lượt mở hồ sơ ứng viên tiềm năng linh hoạt bất cứ lúc nào.',
      points: [
        'Credit có hiệu lực vô thời hạn, không lo hết hạn',
        'Bảo lưu số dư ngay cả khi gói đăng tin kết thúc',
        'Chiết khấu theo mức nạp, hỗ trợ xuất hoá đơn VAT',
      ],
      icon: 'coins',
      imageUrl: '',
      href: 'https://tuyendung.inlink.vn/bang-gia#credit',
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

function pageUrl(value: unknown, fallback: string): string {
  const raw = clip(value, 300);
  if (!raw) return fallback;
  // Nếu dữ liệu cũ trong DB đang là "/bang-gia" chung chung chưa gắn neo (#hash),
  // tự động chuẩn hoá sang URL có neo đúng gói dịch vụ (fallback).
  if (/^(https?:\/\/[^/]+)?\/bang-gia\/?$/i.test(raw)) {
    return fallback;
  }
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return fallback;
}

function iconOf(value: unknown, fallback: HomepageSolutionIcon): HomepageSolutionIcon {
  const raw = clip(value, 20);
  return (HOMEPAGE_SOLUTION_ICONS as readonly string[]).includes(raw) ? (raw as HomepageSolutionIcon) : fallback;
}

function itemOf(value: unknown, fallback: HomepageSolutionItem, index: number): HomepageSolutionItem {
  const row = value && typeof value === 'object' ? (value as Partial<HomepageSolutionItem>) : {};
  const rawTitle = clip(row.title, 80);
  const rawHref = clip(row.href, 300);
  // Chuyển đổi tự động dữ liệu mặc định cũ "Gói doanh nghiệp" (#doanhnghiep) ở thẻ 3 sang Top-up Credit (#credit).
  if (
    index === 2 &&
    rawTitle.toLowerCase() === 'gói doanh nghiệp' &&
    (!rawHref || /\/bang-gia(#doanhnghiep)?\/?$/i.test(rawHref))
  ) {
    return { ...fallback, points: [...fallback.points] as [string, string, string] };
  }
  const source = Array.isArray(row.points) ? row.points : [];
  return {
    title: rawTitle,
    description: clip(row.description, 240),
    points: [0, 1, 2].map((idx) => clip(source[idx], 120) || fallback.points[idx]) as [string, string, string],
    icon: iconOf(row.icon, fallback.icon),
    imageUrl: assetUrl(row.imageUrl),
    href: pageUrl(row.href, fallback.href),
  };
}

function copyDefaults(): HomepageSolutionsContent {
  return {
    ...DEFAULT_HOMEPAGE_SOLUTIONS,
    items: DEFAULT_HOMEPAGE_SOLUTIONS.items.map((item) => ({ ...item, points: [...item.points] as [string, string, string] })),
  };
}

/** Luôn đủ 3 thẻ. Thiếu dữ liệu thì dùng mẫu. */
export function normalizeHomepageSolutions(input: unknown): HomepageSolutionsContent {
  if (input == null || typeof input !== 'object') return copyDefaults();
  const row = input as Partial<HomepageSolutionsContent>;
  const base = DEFAULT_HOMEPAGE_SOLUTIONS;
  const source = Array.isArray(row.items) ? row.items : [];
  return {
    title: clip(row.title, 140) || base.title,
    titleAccent: clip(row.titleAccent, 40),
    subtitle: clip(row.subtitle, 280) || base.subtitle,
    items: base.items.map((fallback, index) =>
      source[index] == null ? { ...fallback, points: [...fallback.points] as [string, string, string] } : itemOf(source[index], fallback, index),
    ),
  };
}
