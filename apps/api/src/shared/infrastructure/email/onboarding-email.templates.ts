import type { EmailMessage } from './email.types';

export function buildOnboardingWelcomeEmail(p: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  startDateLabel: string;
  reportLocation?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  checklist?: string | null;
  applicationsUrl: string;
}): EmailMessage {
  const details = [
    `Vị trí: ${p.jobTitle}`,
    `Công ty: ${p.companyName}`,
    `Ngày nhận việc: ${p.startDateLabel}`,
    p.reportLocation ? `Địa điểm báo cáo: ${p.reportLocation}` : null,
    p.contactName ? `Người liên hệ: ${p.contactName}` : null,
    p.contactPhone ? `Điện thoại: ${p.contactPhone}` : null,
    p.checklist ? `Checklist:\n${p.checklist}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    `Chào mừng bạn gia nhập ${p.companyName}! Dưới đây là thông tin onboarding:`,
    '',
    details,
    '',
    `Chi tiết hồ sơ: ${p.applicationsUrl}`,
    '',
    'Hẹn gặp bạn vào ngày nhận việc. Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#1D4ED8,#3B82F6);padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">IndustrialLink</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Chào mừng — Onboarding</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p>Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
      <p>Chào mừng bạn gia nhập <strong>${esc(p.companyName)}</strong> với vị trí
         <strong>${esc(p.jobTitle)}</strong>.</p>
      <div style="background:#EFF6FF;border-radius:12px;padding:14px;margin:16px 0">
        <div style="font-size:12px;color:#1D4ED8;font-weight:600">Ngày nhận việc</div>
        <div style="font-size:20px;font-weight:800;color:#1E3A8A">${esc(p.startDateLabel)}</div>
      </div>
      ${p.reportLocation ? `<p><strong>Địa điểm:</strong> ${esc(p.reportLocation)}</p>` : ''}
      ${p.contactName ? `<p><strong>Liên hệ:</strong> ${esc(p.contactName)}${p.contactPhone ? ` — ${esc(p.contactPhone)}` : ''}</p>` : ''}
      ${p.checklist ? `<p style="white-space:pre-wrap"><strong>Checklist</strong><br/>${esc(p.checklist)}</p>` : ''}
      <p style="margin-top:20px"><a href="${escAttr(p.applicationsUrl)}"
        style="background:#2563EB;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Xem hồ sơ</a></p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.candidateEmail,
    subject: `[IndustrialLink] Onboarding — ${p.jobTitle} tại ${p.companyName}`,
    text,
    html,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s: string): string {
  return esc(s).replace(/'/g, '&#39;');
}
