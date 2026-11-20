import { resolveApplicationSource } from './application-source.util';

/**
 * ⭐ Kiểm chứng phân loại nguồn ứng viên trên Hộp thư.
 *
 * Quy tắc nghiệp vụ:
 * - Ứng viên tự bấm "Ứng tuyển ngay" (kể cả vào tin thuộc gói Tin săn)
 *   → `self_applied` ("Tự ứng tuyển").
 * - NTD chủ động mở khóa / shortlist / bàn giao từ luồng AI Săn tìm
 *   → `hunt` ("Tin săn nhân sự").
 */
describe('resolveApplicationSource', () => {
  describe('ứng viên tự ứng tuyển', () => {
    it('nộp vào tin thường → Tự ứng tuyển', () => {
      expect(resolveApplicationSource({ hasAppliedFromHuntJob: false })).toBe('self_applied');
    });

    it('⭐ nộp vào tin thuộc gói Tin săn → VẪN là Tự ứng tuyển (không gán nhầm)', () => {
      expect(resolveApplicationSource({ hasAppliedFromHuntJob: true })).toBe('self_applied');
    });

    it('nộp vào tin Săn nhưng NTD chưa mở khóa → Tự ứng tuyển', () => {
      expect(
        resolveApplicationSource({
          hasAppliedFromHuntJob: true,
          openedViaHuntCampaign: false,
          shortlisted: false,
          unlockedViaCredit: false,
        }),
      ).toBe('self_applied');
    });
  });

  describe('NTD chủ động đưa ứng viên vào quy trình từ AI Săn', () => {
    it('mở khóa từ chiến dịch Săn → Tin săn nhân sự', () => {
      expect(
        resolveApplicationSource({
          hasAppliedFromHuntJob: false,
          openedViaHuntCampaign: true,
        }),
      ).toBe('hunt');
    });

    it('NTD lưu vào shortlist → Tin săn nhân sự', () => {
      expect(
        resolveApplicationSource({
          hasAppliedFromHuntJob: false,
          shortlisted: true,
        }),
      ).toBe('hunt');
    });

    it('nộp vào tin Săn + NTD đã mở khóa bằng Credit → Tin săn nhân sự', () => {
      expect(
        resolveApplicationSource({
          hasAppliedFromHuntJob: true,
          unlockedViaCredit: true,
        }),
      ).toBe('hunt');
    });

    it('⭐ ưu tiên tín hiệu AI Săn hơn cờ "nộp vào tin Săn"', () => {
      expect(
        resolveApplicationSource({
          hasAppliedFromHuntJob: true,
          openedViaHuntCampaign: true,
        }),
      ).toBe('hunt');
    });
  });
});
