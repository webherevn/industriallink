/**
 * CHUẨN HÓA NGUỒN ỨNG VIÊN — 1 nguồn sự thật duy nhất cho Hộp thư ứng viên.
 *
 * Lỗi cần sửa: logic cũ gán nguồn theo TIN ĐĂNG
 *   (`huntJobs.has(a.jobId) ? 'hunt' : 'self_applied'`)
 *   → ứng viên tự bấm "Ứng tuyển ngay" vào một tin thuộc gói Tin săn vẫn bị
 *     gán nhầm "Tin săn nhân sự". Điều này sai về mặt nghiệp vụ: nguồn phản ánh
 *     CÁCH ứng viên đến, không phải gói tin đang chạy chiến dịch.
 *
 * Quy tắc đúng:
 *   - Ứng viên tự bấm "Ứng tuyển ngay" (kể cả vào tin của gói Tin săn)
 *       → `self_applied` ("Tự ứng tuyển")
 *   - NTD chủ động mở khóa / shortlist / bàn giao từ luồng AI Săn tìm
 *       → `hunt` ("Tin săn nhân sự")
 *
 * Tín hiệu nhận biết "chủ động từ AI Săn":
 *   1. Giao dịch Credit mở hồ sơ có `campaignId` (mở từ chiến dịch Săn), hoặc
 *   2. Ứng viên nằm trong shortlist của công ty (NTD đã chủ động lưu), hoặc
 *   3. NTD đã mở khóa hồ sơ ứng viên này qua Credit (mọi nguồn) —
 *      hồ sơ tiềm năng đưa vào quy trình từ AI Săn.
 */

import type { ApplicationSource } from '@industriallink/contracts';

/** Action Credit đánh dấu "đã mở khóa hồ sơ ứng viên" (tái sử dụng logic hiện có). */
export const PROFILE_OPEN_ACTIONS = [
  'view_profile',
  'view_profile_high_match',
  'view_applicant',
  'reopen_profile',
  'contact_potential',
  'contact_applicant',
] as const;

/**
 * Phân loại nguồn ứng viên.
 *
 * @param opts.hasAppliedFromHuntJob Ứng viên có tự ứng tuyển vào tin thuộc gói Săn hay không
 *                                    → nếu có thì nguồn là "Tự ứng tuyển", KHÔNG phải "Tin săn".
 * @param opts.openedViaHuntCampaign Ứng viên đã được NTD mở khóa từ chiến dịch AI Săn
 * @param opts.shortlisted            Ứng viên đã được NTD lưu vào shortlist
 * @param opts.unlockedViaCredit      Ứng viên đã được NTD mở khóa bằng Credit (mọi nguồn)
 */
export function resolveApplicationSource(opts: {
  hasAppliedFromHuntJob?: boolean;
  openedViaHuntCampaign?: boolean;
  shortlisted?: boolean;
  unlockedViaCredit?: boolean;
}): ApplicationSource {
  // NTD chủ động đưa ứng viên vào quy trình từ AI Săn → "Tin săn nhân sự".
  if (opts.openedViaHuntCampaign || opts.shortlisted) return 'hunt';

  // Ứng viên tự ứng tuyển → "Tự ứng tuyển" (kể cả khi tin thuộc gói Săn).
  if (!opts.hasAppliedFromHuntJob) return 'self_applied';

  // Ứng viên vào tin Săn nhưng không tự nộp (VD: NTD đã mở khóa bằng Credit
  // rồi ứng viên nộp bổ sung) → vẫn là "Tin săn nhân sự" nếu đã mở khóa,
  // còn lại coi như tự ứng tuyển (an toàn, không gán nhầm nguồn).
  return opts.unlockedViaCredit ? 'hunt' : 'self_applied';
}

/** Nhãn hiển thị của nguồn ứng viên (dùng thống nhất toàn sàn). */
export const APPLICATION_SOURCE_LABEL: Record<ApplicationSource, string> = {
  self_applied: 'Tự ứng tuyển',
  hunt: 'Tin săn nhân sự',
  ai_suggested: 'AI gợi ý',
};
