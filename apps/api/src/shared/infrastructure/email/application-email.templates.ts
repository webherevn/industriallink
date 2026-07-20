import type { EmailMessage } from './email.types';

export function buildApplicationSubmittedEmail(p: {
  recruiterEmail: string;
  candidateName: string;
  jobTitle: string;
  applicantsUrl: string;
}): EmailMessage {
  const text = [
    `Xin chào,`,
    '',
    `${p.candidateName} vừa ứng tuyển vị trí «${p.jobTitle}».`,
    '',
    `Xem hồ sơ: ${p.applicantsUrl}`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">IndustrialLink</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Ứng viên mới</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 12px"><strong>${esc(p.candidateName)}</strong> vừa ứng tuyển vị trí <strong>${esc(p.jobTitle)}</strong>.</p>
      <p style="margin:20px 0 0">
        <a href="${escAttr(p.applicantsUrl)}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">
          Xem hồ sơ ứng viên
        </a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.recruiterEmail,
    subject: `[IndustrialLink] Ứng viên mới — ${p.jobTitle}`,
    text,
    html,
  };
}

export function buildApplicationStatusChangedEmail(p: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  fromLabel: string;
  toLabel: string;
  applicationsUrl: string;
}): EmailMessage {
  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    `Hồ sơ của bạn cho «${p.jobTitle}» đã chuyển từ ${p.fromLabel} sang ${p.toLabel}.`,
    '',
    `Xem chi tiết: ${p.applicationsUrl}`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">IndustrialLink</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Cập nhật hồ sơ ứng tuyển</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 12px">Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
      <p style="margin:0 0 18px;color:#334155">
        Hồ sơ của bạn cho <strong>${esc(p.jobTitle)}</strong> đã chuyển từ
        <strong>${esc(p.fromLabel)}</strong> sang <strong>${esc(p.toLabel)}</strong>.
      </p>
      <p style="margin:0">
        <a href="${escAttr(p.applicationsUrl)}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">
          Xem hồ sơ
        </a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.candidateEmail,
    subject: `[IndustrialLink] Cập nhật hồ sơ — ${p.jobTitle}`,
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
