import { BadRequestException } from '@nestjs/common';

/**
 * (2) KHÓA CỨNG VỊ TRÍ & CẤP BẬC KHI ĐIỀU CHỈNH TIÊU CHÍ TIN SĂN.
 *
 * Bất biến nghiệp vụ: sau khi chiến dịch Tin Săn đã kích hoạt (gói Săn đã mua),
 * NTD KHÔNG được đổi:
 *  - Vị trí tuyển dụng / Chức danh / Nhóm vị trí (`title`, `position`, `roleCategory`).
 *  - Cấp bậc vị trí (`level` / `jobLevel` / `seniority`).
 *
 * Lý do: nếu không khóa, khách có thể mua gói Săn cho vị trí "Nhân viên kinh doanh"
 * rồi đổi sang "Giám đốc" (hoặc đổi sang vị trí khác) trên cùng 1 gói — tức là
 * đổi bản chất vị trí, làm sai lệch giá trị gói đã mua và phễu ứng viên.
 *
 * Các trường ĐƯỢC phép điều chỉnh (tối ưu phạm vi săn):
 *  - Mức thu nhập / ngân sách lương (`salaryMin`, `salaryMax`).
 *  - Số năm kinh nghiệm (`experienceBand`).
 *  - Khu vực làm việc & thị trường phụ trách (`location`, `marketsCovered`).
 *  - Chế độ lọc cứng ngành (`industryHardMode` → `salesCriteria.industryHardMinS`).
 *  - Tệp khách hàng B2B (`customerSegments`).
 *  - Kỹ năng / sản phẩm bổ trợ (`skills`, `productsSold`, `equipmentSystems`...).
 */

export const IMMUTABLE_HUNT_FIELDS_MESSAGE =
  'Vị trí tuyển dụng và Cấp bậc đã được cố định sau khi kích hoạt chiến dịch Tin săn, không thể thay đổi';

/** Chuẩn hoá chuỗi để so sánh "có thay đổi không" (bỏ khoảng trắng + hoa/thường). */
function normalizeLoose(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** 2 giá trị khác nhau → khác biệt có ý nghĩa. */
function differs(a: unknown, b: unknown): boolean {
  const na = normalizeLoose(a);
  const nb = normalizeLoose(b);
  if (!na && !nb) return false;
  return na !== nb;
}

/**
 * Kiểm tra payload cập nhật JD có cố ý đổi Vị trí / Cấp bậc không.
 *
 * @param dto         payload `CreateJobDto` từ client.
 * @param current     giá trị đang lưu trong DB.
 * @throws BadRequestException nếu có thay đổi về vị trí / cấp bậc.
 */
export function assertHuntImmutableFieldsUnchanged(
  dto: {
    title?: string;
    jobLevel?: string | null;
    technicalCriteria?: { position?: string | null } | null;
  },
  current: {
    title?: string | null;
    jobLevel?: string | null;
    technicalPosition?: string | null;
  },
): void {
  // 1) Chức danh (tiêu đề tin) — phải khớp tuyệt đối.
  if (dto.title != null && differs(dto.title, current.title)) {
    throw new BadRequestException(IMMUTABLE_HUNT_FIELDS_MESSAGE);
  }

  // 2) Cấp bậc — phải khớp tuyệt đối (null == null).
  if (dto.jobLevel != null && differs(dto.jobLevel, current.jobLevel)) {
    throw new BadRequestException(IMMUTABLE_HUNT_FIELDS_MESSAGE);
  }

  // 3) Vị trí trong criteria Kỹ thuật (track Sales dùng tiêu đề tin làm vị trí).
  const techPosition = dto.technicalCriteria?.position;
  if (techPosition != null && differs(techPosition, current.technicalPosition)) {
    throw new BadRequestException(IMMUTABLE_HUNT_FIELDS_MESSAGE);
  }
}
