import type { EmailMessage } from './email.types';

export function buildOtpEmail(p: {
  displayName: string;
  email: string;
  otp: string;
  purposeLabel: string;
  expiresMinutes: number;
}): EmailMessage {
  const text = [
    `Xin chào ${p.displayName},`,
    '',
    `Mã xác thực ${p.purposeLabel} của bạn trên IndustrialLink:`,
    '',
    p.otp,
    '',
    `Mã có hiệu lực trong ${p.expiresMinutes} phút. Không chia sẻ mã này với người khác.`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">IndustrialLink</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Mã xác thực OTP</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p>Xin chào <strong>${esc(p.displayName)}</strong>,</p>
      <p>Mã xác thực <strong>${esc(p.purposeLabel)}</strong> của bạn:</p>
      <div style="margin:20px 0;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#1E3A8A">${esc(p.otp)}</div>
      <p style="font-size:13px;color:#64748B">Mã có hiệu lực trong ${p.expiresMinutes} phút. Không chia sẻ mã này với người khác.</p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.email,
    subject: `[IndustrialLink] Mã OTP ${p.purposeLabel}`,
    text,
    html,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
