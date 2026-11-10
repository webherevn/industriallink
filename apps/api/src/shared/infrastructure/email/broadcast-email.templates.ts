import type { EmailMessage } from './email.types';

function interpolateVars(
  raw: string,
  vars: { candidateName: string; companyName: string; jobTitle: string },
): string {
  return raw
    .replace(/\{\{\s*ten_ung_vien\s*\}\}|\{\s*ten_ung_vien\s*\}|\{\s*candidate_name\s*\}/gi, vars.candidateName)
    .replace(/\{\{\s*vi_tri\s*\}\}|\{\s*vi_tri\s*\}|\{\s*job_title\s*\}/gi, vars.jobTitle)
    .replace(/\{\{\s*cong_ty\s*\}\}|\{\s*cong_ty\s*\}|\{\s*company_name\s*\}/gi, vars.companyName);
}

export function buildBroadcastEmail(p: {
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  jobTitle: string;
  subject: string;
  body: string;
  applicationsUrl: string;
}): EmailMessage {
  const vars = {
    candidateName: p.candidateName,
    companyName: p.companyName,
    jobTitle: p.jobTitle,
  };
  const resolvedSubject = interpolateVars(p.subject, vars);
  // Tránh lặp "Xin chào..." nếu NTD đã gõ ở đầu nội dung
  const cleanedRawBody = interpolateVars(p.body, vars).replace(
    /^xin\s+chào[^,\n]*[,:]?\s*\n*/i,
    '',
  );

  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    cleanedRawBody,
    '',
    `— ${p.companyName} · vị trí ${p.jobTitle}`,
    `Xem hồ sơ: ${p.applicationsUrl}`,
    '',
    'Trân trọng,',
    'inlink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F1F5F9;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0F172A">
  <table width="580" style="margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 8px 24px -12px rgba(7,35,72,0.12)">
    <tr><td style="background:linear-gradient(135deg,#072348 0%,#0f386e 100%);padding:24px 28px;color:#ffffff;border-bottom:3px solid #E8872A">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F59E0B">inlink · Thông báo Tuyển dụng</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px;line-height:1.35">${esc(resolvedSubject)}</div>
      <div style="font-size:12px;opacity:0.85;margin-top:4px">${esc(p.companyName)} · Vị trí: ${esc(p.jobTitle)}</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 14px;font-size:15px;color:#0F172A">Xin chào <strong>${esc(p.candidateName)}</strong>,</p>
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.65;color:#334155">${esc(cleanedRawBody)}</div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:13px;color:#475569">
        <strong style="color:#072348">${esc(p.companyName)}</strong><br/>
        <span>Chiến dịch tuyển dụng: ${esc(p.jobTitle)}</span>
      </div>
      <p style="margin-top:20px"><a href="${escAttr(p.applicationsUrl)}"
        style="display:inline-block;background:#072348;color:#ffffff;padding:11px 20px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600">Xem trạng thái hồ sơ trên inlink →</a></p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.candidateEmail,
    subject: `[${p.companyName}] ${resolvedSubject}`,
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
