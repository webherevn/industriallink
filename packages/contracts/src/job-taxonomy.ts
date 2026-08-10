/**
 * Taxonomy tin tuyển dụng dùng chung giữa form NTD và trang tìm việc ứng viên.
 * Giữ đúng giá trị string lưu vào DB (industry = nhóm ngành).
 *
 * Cấu trúc: Nhóm ngành → ngành chi tiết (sub) → vị trí tuyển dụng điển hình (roles).
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
  /** Ngành / sản phẩm–dịch vụ chi tiết (lọc phụ). */
  subIndustries: readonly string[];
  /**
   * @deprecated Dùng `subIndustries.join(', ')`. Giữ để tương thích code cũ.
   */
  details: string;
  /** Vị trí tuyển dụng điển hình (tiếng Việt chuyên môn). */
  roles: readonly string[];
  /** Liên hệ sơ đồ 6 cục. */
  schemaBlocks: readonly IndustrySchemaBlock[];
  /** Ưu tiên hiển thị / go-to-market (1–5). */
  priority: 1 | 2 | 3 | 4 | 5;
}

function catalogItem(
  name: IndustryGroup,
  subIndustries: readonly string[],
  roles: readonly string[],
  schemaBlocks: readonly IndustrySchemaBlock[],
  priority: 1 | 2 | 3 | 4 | 5,
): IndustryCatalogItem {
  return {
    name,
    subIndustries,
    details: subIndustries.join(', '),
    roles,
    schemaBlocks,
    priority,
  };
}

export const INDUSTRY_CATALOG: readonly IndustryCatalogItem[] = [
  catalogItem(
    'Máy móc & Thiết bị công nghiệp',
    [
      'Máy nén khí',
      'Máy phát điện',
      'Máy bơm',
      'Máy công cụ',
      'Thiết bị sản xuất',
      'Thiết bị phụ trợ',
    ],
    [
      'Kỹ sư kinh doanh',
      'Nhân viên kinh doanh',
      'Kỹ sư dịch vụ',
      'Quản lý kinh doanh',
    ],
    [1],
    5,
  ),
  catalogItem(
    'Tự động hóa & Điều khiển',
    [
      'PLC',
      'SCADA',
      'Robot công nghiệp',
      'BMS',
      'MES',
      'Cảm biến',
      'Biến tần',
      'Servo',
      'Tích hợp hệ thống',
    ],
    [
      'Kỹ sư tự động hóa',
      'Kỹ sư kinh doanh',
      'Kỹ sư ứng dụng',
      'Kỹ sư dự án',
    ],
    [1, 2],
    5,
  ),
  catalogItem(
    'Điện & Năng lượng công nghiệp',
    [
      'Điện công nghiệp',
      'Tủ điện',
      'UPS',
      'Máy phát điện',
      'Năng lượng công nghiệp',
      'Tiết kiệm năng lượng',
    ],
    [
      'Kỹ sư điện',
      'Kỹ sư kinh doanh',
      'Kinh doanh dự án',
      'Kỹ sư dịch vụ',
    ],
    [1, 2],
    5,
  ),
  catalogItem(
    'HVAC & Cơ điện M&E',
    [
      'Điều hòa công nghiệp',
      'Chiller',
      'Tháp giải nhiệt',
      'Thông gió',
      'Phòng sạch',
      'Cơ điện (M&E)',
    ],
    [
      'Kỹ sư điều hòa',
      'Kỹ sư dự án',
      'Kỹ sư kinh doanh',
      'Kỹ sư dự toán',
      'Kỹ sư hiện trường',
    ],
    [1, 2],
    5,
  ),
  catalogItem(
    'Cơ khí & Chế tạo máy',
    [
      'Gia công cơ khí',
      'Chế tạo máy',
      'Khuôn mẫu',
      'CNC',
      'Dây chuyền sản xuất',
    ],
    ['Kỹ sư cơ khí', 'Kỹ sư thiết kế', 'Kỹ sư kinh doanh'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Thiết bị & Vật tư MRO',
    [
      'Vòng bi',
      'Dây curoa',
      'Van công nghiệp',
      'Bơm công nghiệp',
      'Phớt làm kín',
      'Dụng cụ',
      'Phụ tùng công nghiệp',
    ],
    [
      'Nhân viên kinh doanh B2B',
      'Kỹ sư kinh doanh',
      'Kinh doanh kỹ thuật',
    ],
    [1],
    5,
  ),
  catalogItem(
    'Thủy lực & Khí nén',
    [
      'Xi lanh',
      'Van khí nén',
      'Van thủy lực',
      'Bơm thủy lực',
      'Hệ thống khí nén',
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư ứng dụng'],
    [1],
    5,
  ),
  catalogItem(
    'Dầu mỡ nhờn & Hóa chất công nghiệp',
    [
      'Dầu công nghiệp',
      'Dầu thủy lực',
      'Dầu máy nén khí',
      'Hóa chất bảo trì',
    ],
    [
      'Nhân viên kinh doanh B2B',
      'Kinh doanh kỹ thuật',
      'Chuyên viên khách hàng lớn',
    ],
    [1],
    5,
  ),
  catalogItem(
    'Đo lường & Thiết bị công nghiệp',
    [
      'Thiết bị đo lường',
      'Cảm biến',
      'Hiệu chuẩn',
      'Thiết bị phòng thí nghiệm',
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư ứng dụng', 'Kỹ sư dịch vụ'],
    [1],
    4,
  ),
  catalogItem(
    'Nhà thầu công nghiệp & EPC',
    [
      'Cơ điện (M&E)',
      'EPC',
      'Nhà thầu tự động hóa',
      'Nhà thầu điều hòa',
      'Nhà thầu nhà máy',
    ],
    [
      'Kinh doanh dự án',
      'Quản lý dự án',
      'Kỹ sư hiện trường',
      'Kỹ sư dự toán',
    ],
    [2],
    5,
  ),
  catalogItem(
    'Nhà máy & Sản xuất công nghiệp',
    [
      'Điện tử',
      'Thực phẩm',
      'Dược phẩm',
      'Ô tô',
      'Linh kiện',
      'Thép',
      'Xi măng',
      'Dệt may',
    ],
    [
      'Kỹ thuật viên bảo trì',
      'Kỹ sư tiện ích nhà máy',
      'Nhân viên sản xuất',
      'Nhân viên QA/QC',
      'Kỹ sư nhà máy',
    ],
    [3],
    4,
  ),
  catalogItem(
    'Logistics & Thiết bị kho vận',
    [
      'Xe nâng',
      'Kho thông minh',
      'Băng tải',
      'Xe tự hành AGV',
      'Thiết bị logistics',
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư kho vận'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Khác',
    ['Ngành công nghiệp khác'],
    ['Kỹ sư kinh doanh', 'Kỹ sư', 'Quản lý dự án'],
    [1],
    1,
  ),
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

/** Tìm nhóm ngành chứa ngành chi tiết (so khớp không phân biệt hoa thường). */
export function findIndustryGroupBySub(sub: string): IndustryGroup | null {
  const n = sub.trim().toLowerCase();
  if (!n) return null;
  for (const item of INDUSTRY_CATALOG) {
    if (item.subIndustries.some((s) => s.toLowerCase() === n)) return item.name;
  }
  return null;
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
  'Kỹ sư điều hòa',
  'Kỹ sư dịch vụ',
  'Kỹ sư tự động hóa',
  'Kỹ sư cơ khí',
] as const;
