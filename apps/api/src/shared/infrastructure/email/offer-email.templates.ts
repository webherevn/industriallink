import type { EmailMessage } from './email.types';

export type OfferLetterPayload = {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  salaryLabel: string;
  startDateLabel?: string | null;
  expiresAtLabel?: string | null;
  benefits?: string | null;
  notes?: string | null;
  applicationsUrl: string;
};

export function buildOfferLetterEmail(p: OfferLetterPayload): EmailMessage {
  const details = [
    `Vị trí: ${p.jobTitle}`,
    `Công ty: ${p.companyName}`,
    `Mức lương đề nghị: ${p.salaryLabel}`,
    p.startDateLabel ? `Ngày nhận việc dự kiến: ${p.startDateLabel}` : null,
    p.expiresAtLabel ? `Hạn phản hồi: ${p.expiresAtLabel}` : null,
    p.benefits ? `Phúc lợi:\n${p.benefits}` : null,
    p.notes ? `Ghi chú: ${p.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    `${p.companyName} trân trọng gửi đến bạn đề nghị tuyển dụng (Offer) trên IndustrialLink.`,
    '',
    details,
    '',
    `Xem chi tiết hồ sơ: ${p.applicationsUrl}`,
    '',
    'Vui lòng phản hồi sớm. Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table width="560" style="background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#0F766E,#14B8A6);padding:24px 28px;color:#fff">
            <div style="font-size:13px;opacity:.9">IndustrialLink</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px">Đề nghị tuyển dụng (Offer)</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            <p style="margin:0 0 12px;font-size:15px">Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#334155">
              <strong>${esc(p.companyName)}</strong> mời bạn nhận offer cho vị trí
              <strong>${esc(p.jobTitle)}</strong>.
            </p>
            <div style="background:#F0FDFA;border:1px solid #99F6E4;border-radius:12px;padding:16px;margin-bottom:16px">
              <div style="font-size:12px;color:#0F766E;font-weight:600">Mức lương đề nghị</div>
              <div style="font-size:22px;font-weight:800;color:#0F766E;margin-top:4px">${esc(p.salaryLabel)}</div>
            </div>
            ${p.startDateLabel ? `<p style="margin:0 0 8px;font-size:13px"><strong>Ngày nhận việc:</strong> ${esc(p.startDateLabel)}</p>` : ''}
            ${p.expiresAtLabel ? `<p style="margin:0 0 8px;font-size:13px"><strong>Hạn phản hồi:</strong> ${esc(p.expiresAtLabel)}</p>` : ''}
            ${p.benefits ? `<p style="margin:12px 0 0;font-size:13px;white-space:pre-wrap"><strong>Phúc lợi</strong><br/>${esc(p.benefits)}</p>` : ''}
            <p style="margin:24px 0 0">
              <a href="${escAttr(p.applicationsUrl)}"
                 style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">
                Xem hồ sơ ứng tuyển
              </a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    to: p.candidateEmail,
    subject: `[IndustrialLink] Offer — ${p.jobTitle} tại ${p.companyName}`,
    text,
    html,
  };
}

export function buildOfferUpdatedEmail(p: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  statusLabel: string;
  applicationsUrl: string;
}): EmailMessage {
  return {
    to: p.candidateEmail,
    subject: `[IndustrialLink] Cập nhật Offer — ${p.jobTitle}`,
    text: `Xin chào ${p.candidateName},\n\nOffer cho «${p.jobTitle}» tại ${p.companyName} đã cập nhật: ${p.statusLabel}.\n\n${p.applicationsUrl}`,
    html: `<p>Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
<p>Offer «${esc(p.jobTitle)}» tại ${esc(p.companyName)}: <strong>${esc(p.statusLabel)}</strong>.</p>
<p><a href="${escAttr(p.applicationsUrl)}">Xem hồ sơ</a></p>`,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s: string): string {
  return esc(s).replace(/'/g, '&#39;');
}
