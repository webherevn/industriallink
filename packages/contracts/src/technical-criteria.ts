/**
 * Tiêu chí hồ sơ Kỹ thuật (IndustrialLink).
 * Field trùng với Sales → tái sử dụng (productsSold, customerSegments, …).
 * File này chỉ chứa options / thang đo đặc thù kỹ thuật.
 */

import { DESIRED_POSITIONS, PRODUCTS_SOLD } from './sales-b2b-criteria';
import {
  CAREER_LADDERS,
  JOB_LEVEL_LABEL,
  JobTrack,
} from './career-path';
import { INDUSTRY_CATALOG } from './job-taxonomy';

/** Alias UI: thiết bị/hệ thống = cùng danh mục sản phẩm Sales. */
export const EQUIPMENT_SYSTEM_OPTIONS = PRODUCTS_SOLD;

/** Vị trí mong muốn — kỹ thuật (bổ sung DESIRED_POSITIONS khi track = technical). */
export const TECHNICAL_DESIRED_POSITIONS = [
  'Kỹ thuật viên',
  'Kỹ sư dịch vụ',
  'Bảo trì',
  'Điện',
  'Cơ khí',
  'Tự động hóa',
  'Thiết kế',
  'Dự án',
  'Quản lý kỹ thuật',
  'Service Engineer',
  'Commissioning Engineer',
  'Khác',
] as const;

export type TechnicalDesiredPosition = (typeof TECHNICAL_DESIRED_POSITIONS)[number];

/** Hãng / công nghệ đã làm việc. */
export const BRANDS_TECHNOLOGIES = [
  'Atlas Copco',
  'ELGi',
  'Ingersoll Rand',
  'Kaeser',
  'Siemens',
  'ABB',
  'Schneider Electric',
  'Mitsubishi Electric',
  'Omron',
  'Allen-Bradley / Rockwell',
  'Fanuc',
  'KUKA',
  'Yaskawa',
  'Panasonic',
  'Danfoss',
  'Grundfos',
  'Wilo',
  'Carrier',
  'Daikin',
  'Trane',
  'Khác',
] as const;

export type BrandTechnology = (typeof BRANDS_TECHNOLOGIES)[number];

/** Loại công việc / nghiệp vụ kỹ thuật (khác sellingStages). */
export const TECHNICAL_WORK_TYPES = [
  'Thiết kế',
  'Lập trình',
  'Bóc tách',
  'Khảo sát',
  'Lắp đặt',
  'Vận hành',
  'Chạy thử / Commissioning',
  'Bảo trì',
  'Chẩn đoán sự cố',
  'Sửa chữa',
  'Bảo dưỡng',
  'Đại tu',
  'Nghiệm thu',
  'Dự án',
  'Cải tiến',
  'Đào tạo',
] as const;

export type TechnicalWorkType = (typeof TECHNICAL_WORK_TYPES)[number];

/** Mức độ tự chủ (1–5). */
export const TECHNICAL_AUTONOMY_LEVELS = [
  { value: 1, label: 'Hỗ trợ / tham gia' },
  { value: 2, label: 'Thực hiện khi có hướng dẫn' },
  { value: 3, label: 'Tự thực hiện' },
  { value: 4, label: 'Xử lý trường hợp phức tạp' },
  { value: 5, label: 'Đào tạo / hướng dẫn người khác' },
] as const;

export type TechnicalAutonomyLevel = (typeof TECHNICAL_AUTONOMY_LEVELS)[number]['value'];

/** Mức xử lý sự cố / troubleshooting (1–5). */
export const TROUBLESHOOTING_LEVELS = [
  { value: 1, label: 'Hỗ trợ theo hướng dẫn' },
  { value: 2, label: 'Kiểm tra và thay thế theo quy trình' },
  { value: 3, label: 'Tự chẩn đoán nguyên nhân và xử lý' },
  { value: 4, label: 'Phân tích lỗi phức tạp, tìm nguyên nhân gốc' },
  { value: 5, label: 'Xây dựng RCA / phòng ngừa và hướng dẫn đội ngũ' },
] as const;

export type TroubleshootingLevel = (typeof TROUBLESHOOTING_LEVELS)[number]['value'];

/** Phần mềm / công cụ kỹ thuật. */
export const TECHNICAL_TOOLS = [
  'AutoCAD',
  'SolidWorks',
  'EPLAN',
  'TIA Portal',
  'GX Works',
  'SCADA / HMI',
  'PLC programming',
  'Revit / BIM',
  'Inventor',
  'MATLAB',
  'Excel kỹ thuật',
  'Khác',
] as const;

export type TechnicalTool = (typeof TECHNICAL_TOOLS)[number];

/** Đọc bản vẽ / tài liệu kỹ thuật. */
export const DOCUMENT_LITERACY_OPTIONS = [
  'Bản vẽ cơ khí',
  'Bản vẽ điện',
  'P&ID',
  'Sơ đồ điều khiển',
  'Datasheet',
  'Manual thiết bị',
  'BOM',
  'Khác',
] as const;

export type DocumentLiteracyOption = (typeof DOCUMENT_LITERACY_OPTIONS)[number];

/** Làm ca / ngoài giờ. */
export const SHIFT_FLEXIBILITY_OPTIONS = [
  { value: 'yes', label: 'Có' },
  { value: 'limited', label: 'Có giới hạn' },
  { value: 'no', label: 'Không' },
] as const;

export type ShiftFlexibility = (typeof SHIFT_FLEXIBILITY_OPTIONS)[number]['value'];

/** Định hướng nghề nghiệp bổ sung cho kỹ thuật (union với CAREER_ORIENTATIONS khi hiển thị). */
export const TECHNICAL_CAREER_ORIENTATIONS = [
  'Kỹ thuật viên',
  'Kỹ sư cấp cao',
  'Kỹ sư dự án',
  'Kỹ sư R&D',
  'Kỹ sư thiết kế',
  'Trưởng nhóm',
  'Trưởng phòng',
  'Chuyên gia trong ngành',
  'Quản lý nhà máy',
  'Quản lý dự án',
  'Giám đốc kỹ thuật',
  'Khác',
] as const;

/** Động lực bổ sung kỹ thuật (union với CAREER_MOTIVATIONS). */
export const TECHNICAL_CAREER_MOTIVATIONS = [
  'Học công nghệ mới',
  'Phát triển chuyên môn',
  'Trở thành chuyên gia',
  'Cơ hội làm dự án lớn',
  'Ít đi công tác',
  'Môi trường quốc tế',
  'Quyền tự chủ',
] as const;

export const JOB_TRACK_OPTIONS = [
  { value: JobTrack.Sales, label: 'Kinh doanh' },
  { value: JobTrack.Technical, label: 'Kỹ thuật' },
] as const;

/** Nhãn field dùng chung nhưng đổi theo track. */
export const TRACK_FIELD_LABELS = {
  productsSold: {
    [JobTrack.Sales]: 'Sản phẩm / giải pháp đã bán',
    [JobTrack.Technical]: 'Thiết bị / hệ thống đã làm',
  },
  customerSegments: {
    [JobTrack.Sales]: 'Tệp khách hàng',
    [JobTrack.Technical]: 'Môi trường làm việc',
  },
  salesHighlights: {
    [JobTrack.Sales]: 'Thành tích nổi bật',
    [JobTrack.Technical]: 'Dự án / thành tích kỹ thuật',
  },
} as const;

/** Câu hỏi tiêu chí #26 — dự án/thành tích nổi bật (kỹ thuật). */
export const TECHNICAL_HIGHLIGHTS_QUESTION =
  'Dự án hoặc công việc kỹ thuật nổi bật nhất?';

/**
 * Gợi ý format thực tế: tên → thiết bị → vai trò → quy mô → kết quả (đúng hạn).
 * Map vào field `salesHighlights` khi jobTrack = technical.
 */
export const TECHNICAL_HIGHLIGHTS_HINT =
  'Tên dự án → thiết bị → vai trò → quy mô → kết quả (bao nhiêu dự án đảm bảo đúng thời hạn)';

export const TECHNICAL_HIGHLIGHTS_PLACEHOLDER =
  'VD: Dự án mở rộng nhà máy A → máy nén khí 250 kW → commissioning lead → 3 line → 5/5 dự án đúng hạn';

function uniquePreserveOrder(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Phân loại role taxonomy ngành → sales / technical. */
function trackOfIndustryRole(role: string): JobTrack | 'both' {
  const r = role.toLowerCase();
  if (/kinh doanh|sales|account|khách hàng lớn|business development|\bbd\b/.test(r)) {
    return JobTrack.Sales;
  }
  if (
    /kỹ sư|bảo trì|kỹ thuật|sản xuất|qa\s*\/\s*qc|plc|hvac|cơ khí|điện|dự toán|hiện trường|ứng dụng|dịch vụ|thiết kế|tự động|kho vận|hệ thống tiện ích/.test(
      r,
    )
  ) {
    return JobTrack.Technical;
  }
  return 'both';
}

const INDUSTRY_ROLES_BY_TRACK: Record<JobTrack, string[]> = (() => {
  const sales: string[] = [];
  const technical: string[] = [];
  for (const item of INDUSTRY_CATALOG) {
    for (const role of item.roles) {
      const t = trackOfIndustryRole(role);
      if (t === JobTrack.Sales || t === 'both') sales.push(role);
      if (t === JobTrack.Technical || t === 'both') technical.push(role);
    }
  }
  return {
    [JobTrack.Sales]: uniquePreserveOrder(sales),
    [JobTrack.Technical]: uniquePreserveOrder(technical),
  };
})();

/**
 * Danh sách vị trí ứng tuyển theo lĩnh vực — gộp:
 * DESIRED_POSITIONS / TECHNICAL_DESIRED_POSITIONS + cấp bậc CAREER_LADDERS + roles taxonomy ngành.
 */
export function desiredPositionOptionsForTrack(
  track: JobTrack | 'sales' | 'technical' | null | undefined,
): string[] {
  const salesCore = [
    ...DESIRED_POSITIONS,
    ...CAREER_LADDERS[JobTrack.Sales].map((c) => JOB_LEVEL_LABEL[c]),
    ...INDUSTRY_ROLES_BY_TRACK[JobTrack.Sales],
  ];
  const techCore = [
    ...TECHNICAL_DESIRED_POSITIONS,
    ...CAREER_LADDERS[JobTrack.Technical].map((c) => JOB_LEVEL_LABEL[c]),
    ...INDUSTRY_ROLES_BY_TRACK[JobTrack.Technical],
  ];

  const key = track ?? null;
  if (key === JobTrack.Technical) return uniquePreserveOrder(techCore);
  if (key === JobTrack.Sales) return uniquePreserveOrder(salesCore);
  return uniquePreserveOrder([...salesCore, ...techCore]);
}
