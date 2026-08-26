/**
 * Taxonomy tin tuyển dụng dùng chung giữa form NTD, trang tìm việc, hồ sơ ứng viên.
 * Nguồn: file chốt ngành nghề iLink 25.08.2026 (điều chỉnh 21.8.2026).
 *
 * Cấu trúc: Nhóm ngành (cột Web) → ngành chi tiết (ứng viên / NTD chọn).
 * Vị trí đang tuyển trên trang tìm việc lấy từ tin đăng trên nền tảng, không hard-code.
 */

/**
 * 12 nhóm ngành hiển thị trên Web — STT 1–12.
 * `Khác` chỉ dùng khi không khớp 12 nhóm; không hiện trên bộ lọc việc làm.
 */
export const INDUSTRY_GROUPS = [
  'Máy móc & Thiết bị sản xuất',
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

/** 12 nhóm chuẩn trên Web (không gồm Khác). */
export const INDUSTRY_GROUPS_WEB: readonly IndustryGroup[] = INDUSTRY_GROUPS.filter(
  (g) => g !== 'Khác',
);

/** Liên hệ sơ đồ 6 cục (domain model IndustrialLink). */
export type IndustrySchemaBlock = 1 | 2 | 3 | 4 | 5 | 6;

/** Ngành chi tiết trong một nhóm (nhãn nhóm + các mục con để lọc). */
export interface IndustrySubGroup {
  name: string;
  items: readonly string[];
}

export interface IndustryCatalogItem {
  name: IndustryGroup;
  /**
   * Ngành chi tiết ứng viên / NTD lựa chọn (cột 3 file 25.08).
   * Một nhóm phẳng — không còn nhóm con tự đặt.
   */
  subGroups: readonly IndustrySubGroup[];
  /** Danh sách phẳng ngành chi tiết (không gồm nhãn nhóm). */
  subIndustries: readonly string[];
  /**
   * @deprecated Dùng `subIndustries.join(', ')`. Giữ để tương thích code cũ.
   */
  details: string;
  /** Nguyên tắc phân loại (cột 4 file 25.08) — gợi ý khi NTD chọn nhóm. */
  classificationPrinciple: string;
  /**
   * Gợi ý vị trí khi NTD soạn tin — bộ lọc tìm việc dùng tin đăng thật trên nền tảng.
   */
  roles: readonly string[];
  /** Liên hệ sơ đồ 6 cục. */
  schemaBlocks: readonly IndustrySchemaBlock[];
  /** Ưu tiên hiển thị / go-to-market (1–5). */
  priority: 1 | 2 | 3 | 4 | 5;
}

function uniqueDetails(items: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function catalogItem(
  name: IndustryGroup,
  details: readonly string[],
  principle: string,
  roles: readonly string[],
  schemaBlocks: readonly IndustrySchemaBlock[],
  priority: 1 | 2 | 3 | 4 | 5,
): IndustryCatalogItem {
  const subIndustries = uniqueDetails(details);
  return {
    name,
    subGroups: [{ name: 'Ngành chi tiết', items: subIndustries }],
    subIndustries,
    details: subIndustries.join(', '),
    classificationPrinciple: principle,
    roles,
    schemaBlocks,
    priority,
  };
}

export const INDUSTRY_CATALOG: readonly IndustryCatalogItem[] = [
  catalogItem(
    'Máy móc & Thiết bị sản xuất',
    [
      'Dây chuyền sản xuất',
      'Máy đóng gói',
      'Máy chiết rót',
      'Máy dán nhãn',
      'Máy ép nhựa',
      'Máy đúc',
      'Máy sấy công nghiệp',
      'Máy trộn',
      'Máy nghiền',
      'Máy cấp liệu',
      'Máy chế biến thực phẩm',
      'Máy chế biến dược phẩm',
      'Máy in công nghiệp',
    ],
    'Thiết bị dây chuyền sản xuất',
    ['Kỹ sư kinh doanh', 'Nhân viên kinh doanh', 'Kỹ sư dịch vụ', 'Quản lý kinh doanh'],
    [1],
    5,
  ),
  catalogItem(
    'Tự động hóa & Điều khiển',
    [
      'PLC',
      'HMI',
      'SCADA',
      'Robot công nghiệp',
      'BMS',
      'MES',
      'Cảm biến tự động hóa',
      'Biến tần',
      'Servo',
      'Motion Control',
      'Hệ thống điều khiển',
      'Các hệ thống tích hợp IoT',
      'Tích hợp hệ thống tự động hóa',
    ],
    'Tự động hóa, điều khiển và tích hợp hệ thống',
    ['Kỹ sư tự động hóa', 'Kỹ sư kinh doanh', 'Kỹ sư ứng dụng', 'Kỹ sư dự án'],
    [1, 2],
    5,
  ),
  catalogItem(
    'Điện & Năng lượng công nghiệp',
    [
      'Điện công nghiệp',
      'Máy biến áp',
      'Máy phát điện',
      'Tủ điện phân phối',
      'Thiết bị đóng cắt',
      'MCCB/MCB',
      'ACB',
      'ATS',
      'UPS',
      'Thiết bị bảo vệ điện',
      'Hệ thống điện nhà máy',
      'Năng lượng tái tạo',
      'Tiết kiệm năng lượng',
    ],
    'Điện, nguồn điện, phân phối điện và năng lượng',
    ['Kỹ sư điện', 'Kỹ sư kinh doanh', 'Kinh doanh dự án', 'Kỹ sư dịch vụ'],
    [1, 2],
    5,
  ),
  catalogItem(
    'HVAC & Cơ điện M&E',
    [
      'Điều hòa công nghiệp',
      'Chiller',
      'AHU',
      'FCU',
      'Cooling Tower',
      'Thông gió',
      'Hút khói',
      'Phòng sạch',
      'Hệ thống HVAC',
      'Hệ thống M&E/MEP',
      'Cấp thoát nước',
      'PCCC',
    ],
    'Chuyên môn/hệ thống cơ điện công trình',
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
      'CNC',
      'Máy tiện',
      'Máy phay',
      'Máy mài',
      'Máy cắt kim loại',
      'Máy chấn',
      'Máy dập',
      'Máy cắt laser',
      'Khuôn mẫu',
      'Chế tạo máy',
      'Thiết kế cơ khí',
      'Hàn',
      'Kết cấu thép',
    ],
    'Gia công, chế tạo và thiết kế cơ khí',
    ['Kỹ sư cơ khí', 'Kỹ sư thiết kế', 'Kỹ sư kinh doanh'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Thiết bị & Vật tư MRO',
    [
      'Vòng bi',
      'Dây curoa',
      'Xích công nghiệp',
      'Khớp nối',
      'Phớt',
      'Van công nghiệp',
      'Ống công nghiệp',
      'Phụ kiện đường ống',
      'Dụng cụ công nghiệp',
      'Dụng cụ cầm tay',
      'Phụ tùng máy móc',
      'Vật tư tiêu hao',
    ],
    'Vật tư, phụ tùng và thiết bị phục vụ bảo trì',
    ['Nhân viên kinh doanh B2B', 'Kỹ sư kinh doanh', 'Kinh doanh kỹ thuật'],
    [1],
    5,
  ),
  catalogItem(
    'Thủy lực & Khí nén',
    [
      'Hệ thống thủy lực',
      'Hệ thống khí nén',
      'Xi lanh khí nén',
      'Van khí nén',
      'Ống khí nén',
      'Phụ kiện khí nén',
      'Xi lanh thủy lực',
      'Van thủy lực',
      'Bơm thủy lực',
      'Motor thủy lực',
      'Bộ nguồn thủy lực',
    ],
    'Chuyên môn thủy lực và khí nén',
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
      'Dầu bánh răng',
      'Dầu gia công kim loại',
      'Mỡ công nghiệp',
      'Hóa chất bảo trì',
      'Hóa chất xử lý công nghiệp',
      'Keo công nghiệp',
      'Chất làm kín',
      'Hạt nhựa',
      'Phụ gia ngành dệt/nhuộm/giấy',
    ],
    'Dầu, mỡ và hóa chất sử dụng trong công nghiệp',
    ['Nhân viên kinh doanh B2B', 'Kinh doanh kỹ thuật', 'Chuyên viên khách hàng lớn'],
    [1],
    5,
  ),
  catalogItem(
    'Đo lường & Thiết bị công nghiệp',
    [
      'Thiết bị đo áp suất',
      'Đo nhiệt độ',
      'Đo lưu lượng',
      'Đo mức',
      'Phân tích khí',
      'Thiết bị đo điện',
      'Thiết bị đo cơ khí',
      'Hiệu chuẩn',
      'Thiết bị đo lường quan trắc môi trường',
      'Thiết bị phòng thí nghiệm',
    ],
    'Đo lường, phân tích và hiệu chuẩn',
    ['Kỹ sư kinh doanh', 'Kỹ sư ứng dụng', 'Kỹ sư dịch vụ'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Nhà thầu công nghiệp & EPC',
    [
      'Tổng thầu EPC',
      'Tổng thầu xây dựng công nghiệp',
      'Nhà thầu xây dựng nhà máy',
      'Nhà thầu lắp đặt thiết bị',
      'Nhà thầu công nghiệp',
      'Nhà thầu dự án công nghiệp',
      'Nhà thầu bảo trì công nghiệp',
      'Nhà thầu công nghệ',
    ],
    'Loại hình doanh nghiệp/mô hình triển khai dự án, không phải chuyên môn HVAC/M&E',
    ['Kinh doanh dự án', 'Quản lý dự án', 'Kỹ sư hiện trường', 'Kỹ sư dự toán'],
    [2],
    5,
  ),
  catalogItem(
    'Nhà máy & Sản xuất công nghiệp',
    [
      'Điện tử',
      'Bán dẫn',
      'Thực phẩm & Đồ uống',
      'Dược phẩm',
      'Hóa chất',
      'Ô tô & Xe máy',
      'Linh kiện điện tử',
      'Thép & Kim loại',
      'Xi măng',
      'Dệt may',
      'Nhựa & Cao su',
      'Bao bì',
      'Giấy',
      'Gỗ & Nội thất',
    ],
    'Ngành sản xuất/nhà máy mà ứng viên đã làm hoặc phục vụ',
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
      'Kệ kho',
      'Băng tải',
      'AGV/AMR',
      'Kho thông minh',
      'AS/RS',
      'Cầu trục',
      'Cổng trục',
      'Thiết bị nâng hạ',
      'Bàn nâng hạ',
      'Thiết bị xử lý hàng hóa',
      'Thiết bị logistics',
    ],
    'Kho vận, nâng hạ và vận chuyển nội bộ',
    ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư kho vận'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Khác',
    ['Ngành công nghiệp khác', 'Dịch vụ kỹ thuật', 'Thương mại thiết bị'],
    'Ngành chưa nằm trong 12 nhóm chuẩn',
    ['Kỹ sư kinh doanh', 'Kỹ sư', 'Quản lý dự án'],
    [1],
    1,
  ),
] as const;

/** Map giá trị ngành cũ → nhóm ngành chuẩn 25.08. */
export const INDUSTRY_LEGACY_MAP: Readonly<Record<string, IndustryGroup>> = {
  'Máy móc & Thiết bị công nghiệp': 'Máy móc & Thiết bị sản xuất',
  'Cơ điện / M&E': 'HVAC & Cơ điện M&E',
  'Tự động hoá / Automation': 'Tự động hóa & Điều khiển',
  'Tự động hóa / Automation': 'Tự động hóa & Điều khiển',
  'Sản xuất / Manufacturing': 'Nhà máy & Sản xuất công nghiệp',
  'Điện tử / Electronics': 'Nhà máy & Sản xuất công nghiệp',
  'Cơ khí / Mechanical': 'Cơ khí & Chế tạo máy',
  'Logistics / Kho vận': 'Logistics & Thiết bị kho vận',
  'QA / QC': 'Nhà máy & Sản xuất công nghiệp',
  'Kinh doanh B2B': 'Máy móc & Thiết bị sản xuất',
  'Thiết bị điện': 'Điện & Năng lượng công nghiệp',
  'Thiết bị điện / Chiếu sáng / Tự động hóa': 'Điện & Năng lượng công nghiệp',
  Automation: 'Tự động hóa & Điều khiển',
  HVAC: 'HVAC & Cơ điện M&E',
  Manufacturing: 'Nhà máy & Sản xuất công nghiệp',
  Engineering: 'Cơ khí & Chế tạo máy',
  Sales: 'Máy móc & Thiết bị sản xuất',
  Sale: 'Máy móc & Thiết bị sản xuất',
};

const INDUSTRY_SET = new Set<string>(INDUSTRY_GROUPS);
const INDUSTRY_LEGACY_LOWER = new Map(
  Object.entries(INDUSTRY_LEGACY_MAP).map(([k, v]) => [k.toLowerCase(), v]),
);

export function isIndustryGroup(value: string): value is IndustryGroup {
  return INDUSTRY_SET.has(value);
}

/** Chuẩn hoá ngành (legacy / free-text) về giá trị taxonomy nếu khớp. */
export function normalizeIndustry(value: string | null | undefined): IndustryGroup | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (isIndustryGroup(raw)) return raw;
  const mapped = INDUSTRY_LEGACY_MAP[raw] ?? INDUSTRY_LEGACY_LOWER.get(raw.toLowerCase());
  if (mapped) return mapped;
  const lower = raw.toLowerCase();
  const found = INDUSTRY_GROUPS.find((g) => g.toLowerCase() === lower);
  return found ?? null;
}

/** Chuẩn hoá danh sách nhóm ngành (bỏ trùng, map legacy). */
export function normalizeIndustries(values: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values ?? []) {
    const next = normalizeIndustry(raw) ?? raw.trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

/**
 * Giá trị dùng khi lọc DB: tên chuẩn + alias legacy để tin/hồ sơ cũ vẫn khớp.
 */
export function industrySearchValues(selected: string[] | undefined): string[] {
  const out = new Set<string>();
  for (const raw of selected ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out.add(trimmed);
    const normalized = normalizeIndustry(trimmed);
    if (normalized) out.add(normalized);
    if (normalized) {
      for (const [legacy, group] of Object.entries(INDUSTRY_LEGACY_MAP)) {
        if (group === normalized) out.add(legacy);
      }
    }
  }
  return [...out];
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
  const asGroup = normalizeIndustry(sub);
  if (asGroup && asGroup !== 'Khác') return asGroup;
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

/** Phòng ban thuộc khối Kinh doanh — gắn với lộ trình `sales`. */
export const SALES_DEPARTMENTS = ['Kinh doanh'] as const;

/** Phòng ban thuộc khối Kỹ thuật — gắn với lộ trình `technical`. */
export const TECHNICAL_DEPARTMENTS = [
  'Kỹ thuật',
  'Sản xuất',
  'QA / QC',
  'Logistics',
  'Bảo trì',
] as const;

/** Phòng ban dùng được cho cả hai lộ trình. */
export const SHARED_DEPARTMENTS = ['Nhân sự', 'Hành chính'] as const;

/** Danh sách phòng ban hợp lệ với lộ trình đang chọn. */
export function departmentsForTrack(track: 'sales' | 'technical'): string[] {
  if (track === 'sales') return [...SALES_DEPARTMENTS, ...SHARED_DEPARTMENTS];
  return [...TECHNICAL_DEPARTMENTS, ...SHARED_DEPARTMENTS];
}

/** Lộ trình suy ra từ phòng ban chuyên biệt; `null` nếu dùng chung / trống. */
export function trackImpliedByDepartment(
  department: string | null | undefined,
): 'sales' | 'technical' | null {
  if (!department) return null;
  if ((SALES_DEPARTMENTS as readonly string[]).includes(department)) return 'sales';
  if ((TECHNICAL_DEPARTMENTS as readonly string[]).includes(department)) return 'technical';
  return null;
}

export function defaultDepartmentForTrack(track: 'sales' | 'technical'): string {
  return track === 'sales' ? 'Kinh doanh' : 'Kỹ thuật';
}

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
