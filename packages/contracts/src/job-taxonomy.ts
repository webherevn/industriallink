/**
 * Taxonomy tin tuyển dụng dùng chung giữa form NTD và trang tìm việc ứng viên.
 * Giữ đúng giá trị string lưu vào DB (industry / location / department).
 *
 * Nhóm ngành = 12 ngành B2B công nghiệp thực tế tại Việt Nam (+ Khác).
 */

/** Nhóm ngành hiển thị trên Web (giá trị lưu DB). */
export const INDUSTRY_GROUPS = [
  'Máy móc & Thiết bị công nghiệp',
  'Tự động hóa & Điều khiển',
  'Điện & Năng lượng công nghiệp',
  'HVAC & Cơ điện M&E',
  'Cơ khí & Chế tạo máy',
  'Thiết bị & Vật tư MRO',
  'Thủy lực & Khí nén',
  'Dầu mỡ nhờn & Hóa chất công nghiệp',
  'Đo lường & Thiết bị công nghiệp',
  'Nhà thầu công nghiệp & EPC',
  'Nhà máy & Sản xuất công nghiệp',
  'Logistics & Thiết bị kho vận',
  'Khác',
] as const;

export type IndustryGroup = (typeof INDUSTRY_GROUPS)[number];

/** Liên hệ sơ đồ 6 cục (domain model IndustrialLink). */
export type IndustrySchemaBlock = 1 | 2 | 3 | 4 | 5 | 6;

export interface IndustryCatalogItem {
  name: IndustryGroup;
  /** Ngành chi tiết / sản phẩm–dịch vụ điển hình. */
  details: string;
  /** Vị trí tuyển dụng điển hình. */
  roles: readonly string[];
  /** Liên hệ sơ đồ 6 cục. */
  schemaBlocks: readonly IndustrySchemaBlock[];
  /** Ưu tiên hiển thị / go-to-market (1–5). */
  priority: 1 | 2 | 3 | 4 | 5;
}

export const INDUSTRY_CATALOG: readonly IndustryCatalogItem[] = [
  {
    name: 'Máy móc & Thiết bị công nghiệp',
    details:
      'Máy nén khí, máy phát điện, máy bơm, máy công cụ, thiết bị sản xuất, thiết bị phụ trợ',
    roles: [
      'Kỹ sư kinh doanh',
      'Nhân viên kinh doanh',
      'Kỹ sư dịch vụ',
      'Quản lý kinh doanh',
    ],
    schemaBlocks: [1],
    priority: 5,
  },
  {
    name: 'Tự động hóa & Điều khiển',
    details:
      'PLC, SCADA, Robot, BMS, MES, cảm biến, biến tần, servo, tích hợp hệ thống',
    roles: [
      'Kỹ sư tự động hóa',
      'Kỹ sư kinh doanh',
      'Kỹ sư ứng dụng',
      'Kỹ sư dự án',
    ],
    schemaBlocks: [1, 2],
    priority: 5,
  },
  {
    name: 'Điện & Năng lượng công nghiệp',
    details:
      'Điện công nghiệp, tủ điện, UPS, máy phát điện, năng lượng, tiết kiệm năng lượng',
    roles: [
      'Kỹ sư điện',
      'Kỹ sư kinh doanh',
      'Kinh doanh dự án',
      'Kỹ sư dịch vụ',
    ],
    schemaBlocks: [1, 2],
    priority: 5,
  },
  {
    name: 'HVAC & Cơ điện M&E',
    details:
      'Điều hòa công nghiệp, chiller, tháp giải nhiệt, thông gió, phòng sạch, cơ điện',
    roles: [
      'Kỹ sư điều hòa / HVAC',
      'Kỹ sư dự án',
      'Kỹ sư kinh doanh',
      'Kỹ sư dự toán (QS)',
      'Kỹ sư hiện trường',
    ],
    schemaBlocks: [1, 2],
    priority: 5,
  },
  {
    name: 'Cơ khí & Chế tạo máy',
    details: 'Gia công cơ khí, chế tạo máy, khuôn mẫu, CNC, dây chuyền sản xuất',
    roles: ['Kỹ sư cơ khí', 'Kỹ sư thiết kế', 'Kỹ sư kinh doanh'],
    schemaBlocks: [1, 2],
    priority: 4,
  },
  {
    name: 'Thiết bị & Vật tư MRO',
    details: 'Vòng bi, dây curoa, van, bơm, phớt, dụng cụ, phụ tùng công nghiệp',
    roles: ['Kinh doanh B2B', 'Kỹ sư kinh doanh', 'Kinh doanh kỹ thuật'],
    schemaBlocks: [1],
    priority: 5,
  },
  {
    name: 'Thủy lực & Khí nén',
    details: 'Xi lanh, van khí nén, van thủy lực, bơm thủy lực, hệ thống khí nén',
    roles: ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư ứng dụng'],
    schemaBlocks: [1],
    priority: 5,
  },
  {
    name: 'Dầu mỡ nhờn & Hóa chất công nghiệp',
    details: 'Dầu công nghiệp, dầu thủy lực, dầu máy nén khí, hóa chất bảo trì',
    roles: ['Kinh doanh B2B', 'Kinh doanh kỹ thuật', 'Chuyên viên khách hàng lớn'],
    schemaBlocks: [1],
    priority: 5,
  },
  {
    name: 'Đo lường & Thiết bị công nghiệp',
    details:
      'Thiết bị đo lường, cảm biến, hiệu chuẩn, thiết bị phòng thí nghiệm',
    roles: ['Kỹ sư kinh doanh', 'Kỹ sư ứng dụng', 'Kỹ sư dịch vụ'],
    schemaBlocks: [1],
    priority: 4,
  },
  {
    name: 'Nhà thầu công nghiệp & EPC',
    details:
      'Cơ điện, EPC, nhà thầu tự động hóa, nhà thầu HVAC, nhà thầu nhà máy',
    roles: ['Kinh doanh dự án', 'Quản lý dự án', 'Kỹ sư hiện trường', 'Kỹ sư dự toán (QS)'],
    schemaBlocks: [2],
    priority: 5,
  },
  {
    name: 'Nhà máy & Sản xuất công nghiệp',
    details:
      'Điện tử, thực phẩm, dược, ô tô, linh kiện, thép, xi măng, dệt may...',
    roles: ['Bảo trì', 'Hệ thống tiện ích', 'Sản xuất', 'QA / QC', 'Kỹ thuật'],
    schemaBlocks: [3],
    priority: 4,
  },
  {
    name: 'Logistics & Thiết bị kho vận',
    details: 'Xe nâng, kho thông minh, băng tải, xe tự hành AGV, thiết bị logistics',
    roles: ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư kho vận'],
    schemaBlocks: [1, 2],
    priority: 4,
  },
  {
    name: 'Khác',
    details: 'Ngành công nghiệp khác chưa nằm trong 12 nhóm ưu tiên',
    roles: ['Kỹ sư kinh doanh', 'Kỹ sư', 'Quản lý dự án'],
    schemaBlocks: [1],
    priority: 1,
  },
] as const;

/** Map giá trị ngành cũ → nhóm ngành mới (migrate DB / filter). */
export const INDUSTRY_LEGACY_MAP: Readonly<Record<string, IndustryGroup>> = {
  'Cơ điện / M&E': 'HVAC & Cơ điện M&E',
  'Tự động hoá / Automation': 'Tự động hóa & Điều khiển',
  'Tự động hóa / Automation': 'Tự động hóa & Điều khiển',
  'Sản xuất / Manufacturing': 'Nhà máy & Sản xuất công nghiệp',
  'Điện tử / Electronics': 'Nhà máy & Sản xuất công nghiệp',
  'Cơ khí / Mechanical': 'Cơ khí & Chế tạo máy',
  'Logistics / Kho vận': 'Logistics & Thiết bị kho vận',
  'QA / QC': 'Nhà máy & Sản xuất công nghiệp',
  'Kinh doanh B2B': 'Máy móc & Thiết bị công nghiệp',
  Automation: 'Tự động hóa & Điều khiển',
  HVAC: 'HVAC & Cơ điện M&E',
  Manufacturing: 'Nhà máy & Sản xuất công nghiệp',
  Engineering: 'Cơ khí & Chế tạo máy',
  Sales: 'Máy móc & Thiết bị công nghiệp',
};

const INDUSTRY_SET = new Set<string>(INDUSTRY_GROUPS);

export function isIndustryGroup(value: string): value is IndustryGroup {
  return INDUSTRY_SET.has(value);
}

/** Chuẩn hoá ngành (legacy / free-text) về giá trị taxonomy nếu khớp. */
export function normalizeIndustry(value: string | null | undefined): IndustryGroup | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (isIndustryGroup(raw)) return raw;
  const mapped = INDUSTRY_LEGACY_MAP[raw];
  if (mapped) return mapped;
  const lower = raw.toLowerCase();
  const found = INDUSTRY_GROUPS.find((g) => g.toLowerCase() === lower);
  return found ?? null;
}

export function getIndustryCatalog(name: string): IndustryCatalogItem | undefined {
  const normalized = normalizeIndustry(name) ?? (isIndustryGroup(name) ? name : null);
  if (!normalized) return undefined;
  return INDUSTRY_CATALOG.find((i) => i.name === normalized);
}

export const DEPARTMENTS = [
  'Kỹ thuật',
  'Sản xuất',
  'Kinh doanh',
  'QA / QC',
  'Nhân sự',
  'Logistics',
  'Bảo trì',
  'Hành chính',
] as const;

export type DepartmentName = (typeof DEPARTMENTS)[number];

/**
 * Địa điểm ngắn (KCN + vài tỉnh phổ biến) — dùng nhóm KCN trong LocationPicker
 * và tương thích seed/filter cũ. UI chọn địa điểm đầy đủ dùng `@industriallink/vn-admin`.
 */
export const LOCATIONS = [
  'KCN Bắc Ninh',
  'KCN Đồng Nai',
  'KCN Bình Dương',
  'KCN Long An',
  'KCN Hải Phòng',
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
] as const;

export type LocationName = (typeof LOCATIONS)[number];

export interface SalaryPreset {
  label: string;
  min: string;
  max: string;
}

export const SALARY_PRESETS: SalaryPreset[] = [
  { label: 'Thoả thuận', min: '', max: '' },
  { label: '8 – 12 triệu', min: '8000000', max: '12000000' },
  { label: '12 – 18 triệu', min: '12000000', max: '18000000' },
  { label: '15 – 25 triệu', min: '15000000', max: '25000000' },
  { label: '20 – 35 triệu', min: '20000000', max: '35000000' },
  { label: '30 – 50 triệu', min: '30000000', max: '50000000' },
  { label: 'Tuỳ chỉnh', min: '__custom__', max: '__custom__' },
];

/** Từ khóa phổ biến trên hero tìm việc (gợi ý nhanh). */
export const POPULAR_JOB_KEYWORDS = [
  'Kỹ sư kinh doanh',
  'Kỹ sư PLC',
  'Kỹ sư điều hòa / HVAC',
  'Kỹ sư dịch vụ',
  'Kỹ sư tự động hóa',
  'Kỹ sư cơ khí',
] as const;
