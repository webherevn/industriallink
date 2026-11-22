/**
 * Cấu trúc Chân trang chuẩn nền tảng tuyển dụng B2B cho inLink.
 * Lưu trong DB qua CmsFooterSettings (không cần sửa code khi cập nhật link/chính sách).
 */

export type CmsFooterSocialPlatform =
  | 'facebook'
  | 'linkedin'
  | 'threads'
  | 'tiktok'
  | 'youtube'
  | 'zalo'
  | 'other';

export interface CmsFooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface CmsFooterColumnGroup {
  title: string;
  links: CmsFooterLink[];
}

export interface CmsFooterSocial {
  platform: CmsFooterSocialPlatform;
  label: string;
  href: string;
}

export interface CmsStructuredFooter {
  slogan: string;
  companyName: string;
  email: string;
  hotline: string;
  zaloLabel: string;
  zaloUrl: string;
  socials: CmsFooterSocial[];
  columns: CmsFooterColumnGroup[];
  address: string;
  taxCode: string;
  licenseInfo: string;
  bctBadgeUrl: string;
  bctBadgeImageUrl: string;
  bottomLinks: CmsFooterLink[];
}

export const DEFAULT_STRUCTURED_FOOTER: CmsStructuredFooter = {
  slogan:
    'Nền tảng kết nối đúng người, đúng công việc bằng AI Matching cho ngành công nghiệp B2B Việt Nam.',
  companyName: 'CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK',
  email: 'hotro@inlink.vn',
  hotline: '',
  zaloLabel: 'Zalo hỗ trợ ứng viên',
  zaloUrl: 'https://zalo.me',
  socials: [
    { platform: 'facebook', label: 'Inlink Vietnam', href: 'https://www.facebook.com' },
    { platform: 'linkedin', label: 'Inlink Vietnam', href: 'https://www.linkedin.com' },
    { platform: 'threads', label: 'Inlink Vietnam', href: 'https://www.threads.net' },
    { platform: 'tiktok', label: 'Inlink Vietnam', href: 'https://www.tiktok.com' },
  ],
  columns: [
    {
      title: 'Về inLink',
      links: [
        { label: 'Giới thiệu', href: '/trang/gioi-thieu' },
        { label: 'Góc báo chí', href: '/trang/goc-bao-chi' },
        { label: 'Tuyển dụng tại inLink', href: '/trang/tuyen-dung' },
        { label: 'Chương trình Cộng tác viên', href: '/partner' },
        { label: 'Liên hệ hợp tác', href: '/trang/lien-he' },
      ],
    },
    {
      title: 'Dành cho Ứng viên',
      links: [
        { label: 'Tìm việc làm công nghiệp', href: '/viec-lam' },
        { label: 'Tạo CV & Hồ sơ AI', href: '/cv' },
        { label: 'Cẩm nang nghề nghiệp', href: '/cam-nang' },
        { label: 'Hỏi đáp ứng viên', href: '/trang/hoi-dap' },
      ],
    },
    {
      title: 'Dành cho Doanh nghiệp',
      links: [
        { label: 'Đăng tin tuyển dụng', href: 'https://tuyendung.inlink.vn', external: true },
        { label: 'Bảng giá dịch vụ', href: '/bang-gia' },
        { label: 'Dịch vụ Săn nhân sự', href: '/bang-gia#san-nhan-su' },
        { label: 'Giải pháp AI Matching', href: '/bang-gia' },
        { label: 'Liên hệ tư vấn B2B', href: '/trang/lien-he' },
      ],
    },
    {
      title: 'Chính sách & Quy định',
      links: [
        { label: 'Quy chế hoạt động', href: '/trang/quy-che-hoat-dong' },
        { label: 'Điều khoản dịch vụ', href: '/trang/dieu-khoan-dich-vu' },
        { label: 'Chính sách quyền riêng tư', href: '/trang/chinh-sach-quyen-rieng-tu' },
        { label: 'Bảo vệ dữ liệu cá nhân (NĐ 13)', href: '/trang/bao-ve-du-lieu-ca-nhan' },
        { label: 'Điều kiện giao dịch chung', href: '/trang/dieu-kien-giao-dich-chung' },
        { label: 'Thanh toán, giao nhận & hoàn hủy', href: '/trang/chinh-sach-thanh-toan-hoan-huy' },
        { label: 'Giải quyết khiếu nại & tranh chấp', href: '/trang/giai-quyet-khieu-nai' },
        { label: 'Cài đặt Cookie', href: '/trang/cai-dat-cookie' },
      ],
    },
  ],
  address: '',
  taxCode: '',
  licenseInfo: '',
  bctBadgeUrl: '',
  bctBadgeImageUrl: '',
  bottomLinks: [
    { label: 'Điều khoản', href: '/trang/dieu-khoan-dich-vu' },
    { label: 'Bảo mật', href: '/trang/chinh-sach-quyen-rieng-tu' },
    { label: 'Quy chế hoạt động', href: '/trang/quy-che-hoat-dong' },
  ],
};

const VALID_PLATFORMS = new Set<CmsFooterSocialPlatform>([
  'facebook',
  'linkedin',
  'threads',
  'tiktok',
  'youtube',
  'zalo',
  'other',
]);

function clip(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function safeHref(value: unknown): string {
  const raw = clip(value, 500);
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  return '';
}

function normalizeLink(raw: unknown): CmsFooterLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const label = clip(obj.label, 120);
  const href = safeHref(obj.href);
  if (!label || !href) return null;
  const external =
    typeof obj.external === 'boolean' ? obj.external : /^https?:\/\//i.test(href);
  return { label, href, ...(external ? { external: true } : {}) };
}

function normalizeSocial(raw: unknown): CmsFooterSocial | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const p = clip(obj.platform, 20).toLowerCase() as CmsFooterSocialPlatform;
  const platform: CmsFooterSocialPlatform = VALID_PLATFORMS.has(p) ? p : 'other';
  const label = clip(obj.label, 80);
  const href = safeHref(obj.href);
  if (!label && !href) return null;
  return { platform, label: label || platform, href };
}

export function cloneDefaultStructuredFooter(): CmsStructuredFooter {
  return {
    ...DEFAULT_STRUCTURED_FOOTER,
    socials: DEFAULT_STRUCTURED_FOOTER.socials.map((s) => ({ ...s })),
    columns: DEFAULT_STRUCTURED_FOOTER.columns.map((c) => ({
      title: c.title,
      links: c.links.map((l) => ({ ...l })),
    })),
    bottomLinks: DEFAULT_STRUCTURED_FOOTER.bottomLinks.map((l) => ({ ...l })),
  };
}

export function normalizeStructuredFooter(input: unknown): CmsStructuredFooter {
  if (!input || typeof input !== 'object') return cloneDefaultStructuredFooter();
  const raw = input as Partial<CmsStructuredFooter>;
  const base = cloneDefaultStructuredFooter();

  const columns: CmsFooterColumnGroup[] = Array.isArray(raw.columns)
    ? raw.columns
        .slice(0, 5)
        .map((col, idx) => {
          const obj = col && typeof col === 'object' ? (col as Partial<CmsFooterColumnGroup>) : {};
          const title = clip(obj.title, 80) || base.columns[idx]?.title || `Cột ${idx + 1}`;
          const links = Array.isArray(obj.links)
            ? obj.links.map(normalizeLink).filter((x): x is CmsFooterLink => x !== null).slice(0, 14)
            : [];
          return { title, links };
        })
    : base.columns;

  const socials: CmsFooterSocial[] = Array.isArray(raw.socials)
    ? raw.socials.map(normalizeSocial).filter((x): x is CmsFooterSocial => x !== null).slice(0, 8)
    : base.socials;

  const bottomLinks: CmsFooterLink[] = Array.isArray(raw.bottomLinks)
    ? raw.bottomLinks.map(normalizeLink).filter((x): x is CmsFooterLink => x !== null).slice(0, 6)
    : base.bottomLinks;

  return {
    slogan: raw.slogan !== undefined ? clip(raw.slogan, 280) : base.slogan,
    companyName: raw.companyName !== undefined ? clip(raw.companyName, 160) : base.companyName,
    email: raw.email !== undefined ? clip(raw.email, 120) : base.email,
    hotline: raw.hotline !== undefined ? clip(raw.hotline, 60) : base.hotline,
    zaloLabel: raw.zaloLabel !== undefined ? clip(raw.zaloLabel, 80) : base.zaloLabel,
    zaloUrl: raw.zaloUrl !== undefined ? safeHref(raw.zaloUrl) : base.zaloUrl,
    socials,
    columns: columns.length > 0 ? columns : base.columns,
    address: raw.address !== undefined ? clip(raw.address, 260) : base.address,
    taxCode: raw.taxCode !== undefined ? clip(raw.taxCode, 80) : base.taxCode,
    licenseInfo: raw.licenseInfo !== undefined ? clip(raw.licenseInfo, 220) : base.licenseInfo,
    bctBadgeUrl: raw.bctBadgeUrl !== undefined ? safeHref(raw.bctBadgeUrl) : base.bctBadgeUrl,
    bctBadgeImageUrl:
      raw.bctBadgeImageUrl !== undefined ? safeHref(raw.bctBadgeImageUrl) : base.bctBadgeImageUrl,
    bottomLinks,
  };
}
