import { referralSignupNotices } from './referral-signup-notice';

describe('referral signup notices', () => {
  const base = {
    partnerCode: 'CTV26C1',
    partnerUserId: 'ctv-user',
    createdByUserId: 'ctv-user',
    createdByRole: 'recruiter',
    displayName: 'Công ty An',
  };

  it('cộng tác viên tự đăng ký chỉ nhận một chuông về trang của mình', () => {
    const notices = referralSignupNotices(base);
    expect(notices).toEqual([
      {
        userId: 'ctv-user',
        title: 'Có nhà tuyển dụng đăng ký qua mã của bạn',
        body: 'Công ty An đã tạo tài khoản nhà tuyển dụng. Hoa hồng chỉ ghi khi họ thanh toán gói có giá.',
        link: '/recruiter/partner',
      },
    ]);
  });

  it('sale tạo hộ nhận chuông danh sách, và cộng tác viên có tài khoản cũng nhận', () => {
    const notices = referralSignupNotices({
      ...base,
      createdByUserId: 'sales-user',
      createdByRole: 'sales',
    });
    expect(notices.map((notice) => notice.userId)).toEqual(['ctv-user', 'sales-user']);
    expect(notices[1]?.link).toBe('/crm/signups?q=CTV26C1');
  });

  it('mã CRM tạo hộ chưa gắn tài khoản chỉ báo cho SuperAdmin', () => {
    const notices = referralSignupNotices({
      ...base,
      partnerUserId: null,
      createdByUserId: 'admin-user',
      createdByRole: 'super_admin',
    });
    expect(notices).toHaveLength(1);
    expect(notices[0]?.userId).toBe('admin-user');
    expect(notices[0]?.link).toBe('/crm/signups?q=CTV26C1');
  });

  it('người tạo không phải sale thì không nhận chuông CRM', () => {
    const notices = referralSignupNotices({
      ...base,
      partnerUserId: null,
      createdByRole: 'recruiter',
    });
    expect(notices).toEqual([]);
  });
});
