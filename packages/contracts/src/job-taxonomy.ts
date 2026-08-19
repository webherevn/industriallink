/**
 * Taxonomy tin tuyển dụng dùng chung giữa form NTD và trang tìm việc ứng viên.
 * Giữ đúng giá trị string lưu vào DB (industry = nhóm ngành).
 *
 * Cấu trúc: Nhóm ngành → nhóm con → ngành chi tiết.
 * Vị trí đang tuyển trên trang tìm việc lấy từ tin đăng trên nền tảng, không hard-code.
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

/** Ngành chi tiết trong một nhóm (nhãn nhóm + các mục con để lọc). */
export interface IndustrySubGroup {
  name: string;
  items: readonly string[];
}

export interface IndustryCatalogItem {
  name: IndustryGroup;
  /** Nhóm con → ngành chi tiết (UI picker 2 cột). */
  subGroups: readonly IndustrySubGroup[];
  /** Ngành / sản phẩm–dịch vụ chi tiết (flat, gồm cả tên nhóm con). */
  subIndustries: readonly string[];
  /**
   * @deprecated Dùng `subIndustries.join(', ')`. Giữ để tương thích code cũ.
   */
  details: string;
  /**
   * Gợi ý vị trí khi NTD soạn tin — bộ lọc tìm việc dùng tin đăng thật trên nền tảng.
   */
  roles: readonly string[];
  /** Liên hệ sơ đồ 6 cục. */
  schemaBlocks: readonly IndustrySchemaBlock[];
  /** Ưu tiên hiển thị / go-to-market (1–5). */
  priority: 1 | 2 | 3 | 4 | 5;
}

function flattenSubIndustries(groups: readonly IndustrySubGroup[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const item of [g.name, ...g.items]) {
      const t = item.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

function catalogItem(
  name: IndustryGroup,
  subGroups: readonly IndustrySubGroup[],
  roles: readonly string[],
  schemaBlocks: readonly IndustrySchemaBlock[],
  priority: 1 | 2 | 3 | 4 | 5,
): IndustryCatalogItem {
  const subIndustries = flattenSubIndustries(subGroups);
  return {
    name,
    subGroups,
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
      {
        name: 'Máy nén khí',
        items: [
          'Máy nén khí trục vít',
          'Máy nén khí piston',
          'Máy sấy khí',
          'Bình chứa khí nén',
        ],
      },
      {
        name: 'Máy phát điện',
        items: ['Máy phát diesel', 'Máy phát gas', 'Tổ máy phát dự phòng'],
      },
      {
        name: 'Máy bơm',
        items: ['Bơm ly tâm', 'Bơm định lượng', 'Bơm chìm', 'Bơm công nghiệp'],
      },
      {
        name: 'Máy công cụ',
        items: ['Máy CNC', 'Máy cắt laser', 'Máy chấn / dập', 'Máy hàn'],
      },
      {
        name: 'Thiết bị sản xuất',
        items: ['Dây chuyền sản xuất', 'Máy đóng gói', 'Thiết bị phụ trợ nhà máy'],
      },
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
      {
        name: 'PLC / HMI',
        items: ['PLC', 'HMI', 'Tủ điều khiển'],
      },
      {
        name: 'Truyền động',
        items: ['Biến tần', 'Servo', 'Động cơ điện'],
      },
      {
        name: 'Robot & AGV',
        items: ['Robot công nghiệp', 'Robot cộng tác', 'AGV / AMR'],
      },
      {
        name: 'Phần mềm điều khiển',
        items: ['SCADA', 'MES', 'BMS', 'DCS'],
      },
      {
        name: 'Cảm biến & tích hợp',
        items: ['Cảm biến', 'Mạng công nghiệp', 'Tích hợp hệ thống'],
      },
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
      {
        name: 'Điện công nghiệp',
        items: ['Tủ điện', 'MBA / máy biến áp', 'Hệ thống trung thế'],
      },
      {
        name: 'Nguồn & dự phòng',
        items: ['UPS', 'Máy phát điện', 'Pin lưu trữ'],
      },
      {
        name: 'Năng lượng',
        items: ['Năng lượng công nghiệp', 'Tiết kiệm năng lượng', 'Điện mặt trời công nghiệp'],
      },
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
      {
        name: 'Điều hòa công nghiệp',
        items: ['Chiller', 'AHU / FCU', 'VRV / VRF'],
      },
      {
        name: 'Thông gió & giải nhiệt',
        items: ['Tháp giải nhiệt', 'Thông gió', 'Cooling Tower'],
      },
      {
        name: 'Cơ điện nhà máy',
        items: ['Cơ điện (M&E)', 'Phòng sạch', 'MEP công trình'],
      },
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
      {
        name: 'Gia công cơ khí',
        items: ['CNC', 'Gia công tiện / phay', 'Gia công chính xác'],
      },
      {
        name: 'Chế tạo máy',
        items: ['Chế tạo máy', 'Khuôn mẫu', 'Dây chuyền sản xuất'],
      },
      {
        name: 'Kết cấu & hàn',
        items: ['Gia công kết cấu', 'Hàn công nghiệp'],
      },
    ],
    ['Kỹ sư cơ khí', 'Kỹ sư thiết kế', 'Kỹ sư kinh doanh'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Thiết bị & Vật tư MRO',
    [
      {
        name: 'Vật tư truyền động',
        items: ['Vòng bi', 'Dây curoa', 'Xích công nghiệp'],
      },
      {
        name: 'Van & bơm',
        items: ['Van công nghiệp', 'Bơm công nghiệp', 'Phớt làm kín'],
      },
      {
        name: 'Phụ tùng bảo trì',
        items: ['Dụng cụ', 'Phụ tùng công nghiệp', 'Vật tư MRO'],
      },
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
      {
        name: 'Khí nén',
        items: ['Hệ thống khí nén', 'Van khí nén', 'Xi lanh khí nén'],
      },
      {
        name: 'Thủy lực',
        items: ['Bơm thủy lực', 'Van thủy lực', 'Xi lanh thủy lực'],
      },
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư ứng dụng'],
    [1],
    5,
  ),
  catalogItem(
    'Dầu mỡ nhờn & Hóa chất công nghiệp',
    [
      {
        name: 'Dầu nhớt công nghiệp',
        items: ['Dầu công nghiệp', 'Dầu thủy lực', 'Dầu máy nén khí'],
      },
      {
        name: 'Hóa chất bảo trì',
        items: ['Hóa chất bảo trì', 'Dung môi công nghiệp', 'Chất tẩy rửa công nghiệp'],
      },
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
      {
        name: 'Thiết bị đo',
        items: ['Thiết bị đo lường', 'Cảm biến', 'Đồng hồ áp / nhiệt'],
      },
      {
        name: 'Hiệu chuẩn & lab',
        items: ['Hiệu chuẩn', 'Thiết bị phòng thí nghiệm'],
      },
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư ứng dụng', 'Kỹ sư dịch vụ'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Nhà thầu công nghiệp & EPC',
    [
      {
        name: 'EPC / tổng thầu',
        items: ['EPC', 'Nhà thầu nhà máy', 'Tổng thầu công nghiệp'],
      },
      {
        name: 'Nhà thầu chuyên ngành',
        items: ['Cơ điện (M&E)', 'Nhà thầu tự động hóa', 'Nhà thầu điều hòa'],
      },
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
      {
        name: 'Ngành sản xuất',
        items: ['Điện tử', 'Thực phẩm', 'Dược phẩm', 'Ô tô', 'Linh kiện'],
      },
      {
        name: 'Vật liệu & nặng',
        items: ['Thép', 'Xi măng', 'Dệt may', 'Nhựa / cao su'],
      },
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
      {
        name: 'Thiết bị kho',
        items: ['Xe nâng', 'Băng tải', 'Kệ kho / racking'],
      },
      {
        name: 'Kho tự động',
        items: ['Kho thông minh', 'Xe tự hành AGV', 'WMS / kho vận'],
      },
    ],
    ['Kỹ sư kinh doanh', 'Kỹ sư dịch vụ', 'Kỹ sư kho vận'],
    [1, 2],
    4,
  ),
  catalogItem(
    'Khác',
    [{ name: 'Ngành công nghiệp khác', items: ['Dịch vụ kỹ thuật', 'Thương mại thiết bị'] }],
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
    if (item.subGroups.some((g) => g.name.toLowerCase() === n)) return item.name;
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
