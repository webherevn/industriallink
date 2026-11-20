/**
 * Unit test cho `describeCreditAction` — map `actionType` thô sang tiếng Việt đầy đủ.
 *
 * Yêu cầu nghiệp vụ:
 * - KHÔNG lộ mã kỹ thuật (`view_profile`) cho NTD.
 * - `view_profile` -> "Mở hồ sơ ứng viên" + tên/mã ứng viên nếu có trong metadata.
 * - `package_grant` -> "Cấp [X] Credit khi kích hoạt gói [Tên gói]".
 */
import { CREDIT_ACTION_LABELS, describeCreditAction } from '@industriallink/contracts';

describe('describeCreditAction', () => {
  it('map view_profile sang tiếng Việt + tên ứng viên', () => {
    const label = describeCreditAction('view_profile', {
      candidateName: 'Nguyễn Văn A',
      candidateCode: 'UD-000123',
    });
    expect(label).toContain('Mở hồ sơ ứng viên');
    expect(label).not.toContain('view_profile');
    expect(label).toContain('Nguyễn Văn A');
  });

  it('fallback sang mã ứng viên khi không có tên', () => {
    const label = describeCreditAction('view_profile', { candidateCode: 'UD-000123' });
    expect(label).toContain('UD-000123');
  });

  it('không lộ mã thô khi không có metadata ứng viên', () => {
    const label = describeCreditAction('view_profile');
    expect(label).toBe('Mở hồ sơ ứng viên');
    expect(label).not.toContain('view_profile');
  });

  it('format package_grant thành "Cấp [X] Credit khi kích hoạt gói [Tên gói]"', () => {
    const label = describeCreditAction('package_grant', {
      granted: 50,
      packageName: 'TIN SĂN CHUYÊN SÂU',
    });
    expect(label).toBe('Cấp 50 Credit khi kích hoạt gói TIN SĂN CHUYÊN SÂU');
  });

  it('format package_grant với mã gói khi không có tên', () => {
    const label = describeCreditAction('package_grant', {
      granted: 30,
      packageCode: 'TS-000101',
    });
    expect(label).toBe('Cấp 30 Credit khi kích hoạt gói TS-000101');
  });

  it('format topup thành "Nạp [X] Credit vào Ví"', () => {
    expect(describeCreditAction('topup', { amount: 100 })).toBe('Nạp 100 Credit vào Ví');
  });

  it('có nhãn tiếng Việt cho MỌI CreditAction', () => {
    for (const action of Object.keys(CREDIT_ACTION_LABELS)) {
      const label = describeCreditAction(action);
      expect(label).toBeTruthy();
      expect(label).not.toContain(action);
    }
  });

  it('fallback về note gốc khi action lạ', () => {
    expect(describeCreditAction('weird_action', null, 'Ghi chú gốc')).toBe('Ghi chú gốc');
  });
});
