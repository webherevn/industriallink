import type { EmailMessage } from './email.types';

export function buildBroadcastEmail(p: {
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  subject: string;
  body: string;
  applicationsUrl: string;
}): EmailMessage {
  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    p.body,
    '',
    `— ${p.companyName} · vị trí ${p.jobTitle}`,
    `Xem hồ sơ: ${p.applicationsUrl}`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#0F766E,#14B8A6);padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">IndustrialLink</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px">${esc(p.subject)}</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p>Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#334155">${esc(p.body)}</div>
      <p style="margin-top:20px;font-size:13px;color:#64748B">
        ${esc(p.companyName)} · ${esc(p.jobTitle)}
      </p>
      <p style="margin-top:16px"><a href="${escAttr(p.applicationsUrl)}"
        style="background:#0F766E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Xem hồ sơ</a></p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.candidateEmail,
    subject: `[${p.companyName}] ${p.subject}`,
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
