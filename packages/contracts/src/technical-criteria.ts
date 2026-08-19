/**
 * Tiêu chí hồ sơ Kỹ thuật — ma trận 31 mục (update 18.8).
 * Mục 1–12 dùng chung với Kinh doanh; file này chứa B (13–16 phần riêng),
 * C (17–23) và D (24–31) đặc thù kỹ thuật.
 */

import { DESIRED_POSITIONS } from './sales-b2b-criteria';
import { JobTrack } from './career-path';

/** STT 28. Thiết bị / hệ thống đã trực tiếp làm việc (19%) — search + chọn nhiều + nhập thêm. */
export const EQUIPMENT_SYSTEM_OPTIONS = [
  'Cơ khí / Cơ khí chế tạo',
  'Điện / Điện công nghiệp',
  'Tự động hóa / Điều khiển',
  'Điện tử / Điện tử công nghiệp',
  'HVAC / Điều hòa – thông gió',
  'M&E / MEP',
  'Khí nén',
  'Thủy lực',
  'Bơm / Van / Thiết bị công nghiệp',
  'Năng lượng / Điện năng',
  'Sản xuất / Công nghệ sản xuất',
  'Bảo trì / Bảo dưỡng công nghiệp',
  'Xây dựng / Công trình kỹ thuật',
  'PCCC',
  'Xử lý nước / Môi trường',
  'Đo lường / Thiết bị đo',
  'Robot / Tự động hóa sản xuất',
] as const;

export const EQUIPMENT_SYSTEM_QUESTION =
  'Anh/chị trực tiếp làm việc với thiết bị/hệ thống nào?';

/** STT 13. Vị trí ứng tuyển — kỹ thuật (chọn tối đa 3, có "Khác" tự nhập). */
export const TECHNICAL_DESIRED_POSITIONS = [
  'Kỹ thuật viên',
  'Kỹ sư dịch vụ / Bảo trì – sửa chữa',
  'Kỹ sư cơ khí',
  'Kỹ sư điện / Điện công nghiệp',
  'Kỹ sư tự động hóa / Điều khiển',
  'Kỹ sư thiết kế',
  'Kỹ sư dự án',
  'Kỹ sư sản xuất / Quy trình',
  'Kỹ sư chất lượng QA/QC',
  'Kỹ sư R&D',
  'Quản lý kỹ thuật',
  'Quản lý dự án',
  'Quản lý / vận hành nhà máy',
] as const;

export type TechnicalDesiredPosition = (typeof TECHNICAL_DESIRED_POSITIONS)[number];

export const TECHNICAL_POSITION_QUESTION =
  'Anh/chị đang tìm công việc nào? Chọn tối đa 3 vị trí phù hợp nhất.';

/** Hãng / công nghệ — catalog FDI/B2B VN (xem fdi-b2b-brands.ts). */
export {
  BRANDS_TECHNOLOGIES,
  FDI_B2B_BRANDS,
  suggestFdiB2bBrands,
  type BrandTechnology,
  type CompanySuggestItem,
  type CompanySuggestResponse,
  type FdiB2bBrand,
  type FdiBrandPriority,
} from './fdi-b2b-brands';

/** STT 30. Công việc kỹ thuật đã trực tiếp thực hiện (17%). */
export const TECHNICAL_WORK_TYPES = [
  'Thiết kế',
  'Lập trình / cài đặt',
  'Bóc tách / khảo sát',
  'Lắp đặt',
  'Vận hành',
  'Chạy thử / bàn giao',
  'Bảo trì / bảo dưỡng',
  'Sửa chữa',
  'Xử lý sự cố',
  'Nghiệm thu',
  'Cải tiến / nâng cấp',
  'Đào tạo / hướng dẫn',
] as const;

export type TechnicalWorkType = (typeof TECHNICAL_WORK_TYPES)[number];

export const TECHNICAL_WORK_TYPES_QUESTION =
  'Anh/chị đã trực tiếp thực hiện những công việc nào?';

/** STT 31. Mức độ tự chủ trong công việc kỹ thuật (8%) — chọn mức cao nhất phù hợp. */
export const TECHNICAL_AUTONOMY_LEVELS = [
  { value: 1, label: 'Cần người hướng dẫn' },
  { value: 2, label: 'Có thể làm theo hướng dẫn' },
  { value: 3, label: 'Có thể tự thực hiện' },
  { value: 4, label: 'Có thể tự xử lý công việc phức tạp' },
  { value: 5, label: 'Có thể hướng dẫn người khác' },
] as const;

export type TechnicalAutonomyLevel = (typeof TECHNICAL_AUTONOMY_LEVELS)[number]['value'];

export const TECHNICAL_AUTONOMY_QUESTION =
  'Anh/chị có thể tự thực hiện công việc ở mức nào? Chọn mức cao nhất phù hợp.';

/** Mức xử lý sự cố / troubleshooting (1–5). */
export const TROUBLESHOOTING_LEVELS = [
  { value: 1, label: 'Hỗ trợ theo hướng dẫn' },
  { value: 2, label: 'Kiểm tra và thay thế theo quy trình' },
  { value: 3, label: 'Tự chẩn đoán nguyên nhân và xử lý' },
  { value: 4, label: 'Phân tích lỗi phức tạp, tìm nguyên nhân gốc' },
  { value: 5, label: 'Xây dựng RCA / phòng ngừa và hướng dẫn đội ngũ' },
] as const;

export type TroubleshootingLevel = (typeof TROUBLESHOOTING_LEVELS)[number]['value'];

/** STT 18. Phần mềm & công cụ đã sử dụng (2%) — chọn nhiều + "Khác" tự nhập. */
export const TECHNICAL_TOOLS = [
  'AutoCAD',
  'SolidWorks',
  'Inventor',
  'Revit',
  'PLC / HMI',
  'ERP / SAP',
  'Word/Excel',
] as const;

export type TechnicalTool = (typeof TECHNICAL_TOOLS)[number];

export const TECHNICAL_TOOLS_QUESTION =
  'Anh/chị sử dụng được những phần mềm/công cụ kỹ thuật nào?';

/** STT 19. Đọc bản vẽ / tài liệu kỹ thuật (2%) — chọn nhiều + "Khác" tự nhập. */
export const DOCUMENT_LITERACY_OPTIONS = [
  'Bản vẽ cơ khí',
  'Bản vẽ điện',
  'P&ID / sơ đồ công nghệ',
  'Datasheet / thông số kỹ thuật',
  'Manual / tài liệu hướng dẫn',
] as const;

export type DocumentLiteracyOption = (typeof DOCUMENT_LITERACY_OPTIONS)[number];

export const DOCUMENT_LITERACY_QUESTION = 'Anh/chị có thể đọc những tài liệu nào?';

/** STT 17. Khả năng làm ngoài giờ / xử lý sự cố khi cần (1%). */
export const SHIFT_FLEXIBILITY_OPTIONS = [
  { value: 'yes', label: 'Có, sẵn sàng' },
  { value: 'limited', label: 'Có, nhưng có giới hạn' },
  { value: 'no', label: 'Không thể' },
] as const;

export type ShiftFlexibility = (typeof SHIFT_FLEXIBILITY_OPTIONS)[number]['value'];

export const SHIFT_FLEXIBILITY_QUESTION =
  'Anh/chị có thể làm ngoài giờ hoặc xử lý sự cố khi cần không?';

/** STT 21. Định hướng nghề nghiệp 2–3 năm tới (tham khảo, 0%) — chọn 1. */
export const TECHNICAL_CAREER_ORIENTATIONS = [
  'Trở thành chuyên gia kỹ thuật',
  'Kỹ thuật dự án',
  'Thiết kế / R&D',
  'Quản lý kỹ thuật',
  'Quản lý dự án',
  'Quản lý vận hành / nhà máy',
  'Chưa xác định rõ',
  'Khác',
] as const;

export const TECHNICAL_ORIENTATION_QUESTION =
  'Trong 2–3 năm tới anh/chị muốn phát triển theo hướng nào? Chọn 1 hướng phù hợp nhất.';

/** STT 22. Động lực khi lựa chọn công việc mới (tham khảo, 0%) — chọn 3. */
export const TECHNICAL_CAREER_MOTIVATIONS = [
  'Thu nhập tốt',
  'Công việc ổn định, lâu dài',
  'Được làm đúng chuyên môn',
  'Được học thêm kỹ thuật / công nghệ mới',
  'Có cơ hội làm dự án lớn',
  'Có cơ hội thăng tiến',
  'Có cơ hội trở thành chuyên gia',
  'Được chủ động trong công việc',
  'Môi trường làm việc tốt',
  'Khác',
] as const;

export const TECHNICAL_MOTIVATION_QUESTION =
  'Hãy chọn 3 yếu tố quan trọng nhất khi anh/chị lựa chọn công việc mới.';

/** STT 20. Cách làm việc kỹ thuật (1%) — chọn tối đa 3. */
export const TECHNICAL_WORK_STYLES = [
  'Ưu tiên an toàn và đúng quy trình',
  'Phân tích nguyên nhân trước khi xử lý',
  'Chủ động tìm cách xử lý',
  'Ưu tiên khắc phục nhanh để thiết bị hoạt động lại',
  'Phối hợp với đồng nghiệp / bộ phận liên quan',
] as const;

export const TECHNICAL_WORK_STYLE_QUESTION =
  'Anh/chị xử lý các tình huống kỹ thuật như thế nào? Chọn tối đa 3 phương án phù hợp nhất.';

/** STT 23 (mong muốn) & 29 (thực tế). Môi trường làm việc. */
export const WORK_ENVIRONMENT_OPTIONS = [
  'Nhà máy / xưởng',
  'Công trường / dự án',
  'Tại khách hàng',
  'Văn phòng',
] as const;

export const WORK_ENVIRONMENT_DESIRED_QUESTION =
  'Anh/chị làm việc hiệu quả nhất trong môi trường nào? Chọn tối đa 3.';

export const WORK_ENVIRONMENT_ACTUAL_QUESTION =
  'Anh/chị chủ yếu làm việc trong môi trường nào?';

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
    [JobTrack.Technical]: 'Môi trường làm việc thực tế',
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

/**
 * Danh sách vị trí ứng tuyển theo lĩnh vực (STT 13).
 * Kinh doanh: đúng 5 vị trí theo ma trận 34 mục (update 18.8).
 * Kỹ thuật: đúng 13 vị trí theo ma trận 31 mục (update 18.8), "Khác" tự nhập ở UI.
 */
export function desiredPositionOptionsForTrack(
  track: JobTrack | 'sales' | 'technical' | null | undefined,
): string[] {
  const salesCore = [...DESIRED_POSITIONS];
  const techCore = [...TECHNICAL_DESIRED_POSITIONS];

  const key = track ?? null;
  if (key === JobTrack.Technical) return uniquePreserveOrder(techCore);
  if (key === JobTrack.Sales) return uniquePreserveOrder(salesCore);
  return uniquePreserveOrder([...salesCore, ...techCore]);
}
