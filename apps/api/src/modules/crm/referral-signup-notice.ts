export type ReferralSignupNotice = {
  userId: string;
  title: string;
  body: string;
  link: string;
};

/** Ai nhận chuông khi có nhà tuyển dụng đăng ký qua mã. Không kèm email hay số điện thoại. */
export function referralSignupNotices(input: {
  partnerCode: string;
  partnerUserId: string | null;
  createdByUserId: string;
  createdByRole: string | null;
  displayName: string;
}): ReferralSignupNotice[] {
  const body = `${input.displayName} đã tạo tài khoản nhà tuyển dụng. Hoa hồng chỉ ghi khi họ thanh toán gói có giá.`;
  const notices: ReferralSignupNotice[] = [];
  if (input.partnerUserId) {
    notices.push({
      userId: input.partnerUserId,
      title: 'Có nhà tuyển dụng đăng ký qua mã của bạn',
      body,
      link: '/recruiter/partner',
    });
  }
  const ownerIsCrm = input.createdByRole === 'sales' || input.createdByRole === 'super_admin';
  if (ownerIsCrm && input.createdByUserId !== input.partnerUserId) {
    notices.push({
      userId: input.createdByUserId,
      title: `Nhà tuyển dụng đăng ký qua mã ${input.partnerCode}`,
      body,
      link: `/crm/signups?q=${encodeURIComponent(input.partnerCode)}`,
    });
  }
  return notices;
}
