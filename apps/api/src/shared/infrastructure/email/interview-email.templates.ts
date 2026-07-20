import type { EmailMessage } from './email.types';

export type InterviewInvitePayload = {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  typeLabel: string;
  scheduledAtLabel: string;
  durationMinutes: number;
  location?: string | null;
  meetingLink?: string | null;
  interviewerName?: string | null;
  notes?: string | null;
  applicationsUrl: string;
};

export function buildInterviewInviteEmail(p: InterviewInvitePayload): EmailMessage {
  const details = [
    `Vị trí: ${p.jobTitle}`,
    `Công ty: ${p.companyName}`,
    `Loại: ${p.typeLabel}`,
    `Thời gian: ${p.scheduledAtLabel}`,
    `Thời lượng: ${p.durationMinutes} phút`,
    p.interviewerName ? `Người phỏng vấn: ${p.interviewerName}` : null,
    p.location ? `Địa điểm: ${p.location}` : null,
    p.meetingLink ? `Link họp: ${p.meetingLink}` : null,
    p.notes ? `Ghi chú: ${p.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    `${p.companyName} mời bạn tham gia buổi phỏng vấn trên IndustrialLink.`,
    '',
    details,
    '',
    `Xem hồ sơ ứng tuyển: ${p.applicationsUrl}`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const rows = [
    ['Vị trí', escapeHtml(p.jobTitle)],
    ['Công ty', escapeHtml(p.companyName)],
    ['Loại', escapeHtml(p.typeLabel)],
    ['Thời gian', escapeHtml(p.scheduledAtLabel)],
    ['Thời lượng', `${p.durationMinutes} phút`],
    p.interviewerName ? ['Người phỏng vấn', escapeHtml(p.interviewerName)] : null,
    p.location ? ['Địa điểm', escapeHtml(p.location)] : null,
    p.meetingLink
      ? [
          'Link họp',
          `<a href="${escapeAttr(p.meetingLink)}" style="color:#2563EB">${escapeHtml(p.meetingLink)}</a>`,
        ]
      : null,
    p.notes ? ['Ghi chú', escapeHtml(p.notes)] : null,
  ].filter(Boolean) as [string, string][];

  const html = `<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:24px 28px;color:#fff">
            <div style="font-size:13px;opacity:.85">IndustrialLink</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px">Lời mời phỏng vấn</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px">
            <p style="margin:0 0 12px;font-size:15px">Xin chào <strong>${escapeHtml(p.candidateName)}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#334155">
              <strong>${escapeHtml(p.companyName)}</strong> mời bạn tham gia buổi phỏng vấn cho vị trí
              <strong>${escapeHtml(p.jobTitle)}</strong>.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0">
              ${rows
                .map(
                  ([k, v]) =>
                    `<tr>
                      <td style="padding:10px 14px;font-size:12px;color:#64748B;width:34%;border-bottom:1px solid #E2E8F0">${k}</td>
                      <td style="padding:10px 14px;font-size:13px;color:#0F172A;border-bottom:1px solid #E2E8F0">${v}</td>
                    </tr>`,
                )
                .join('')}
            </table>
            <p style="margin:24px 0 0">
              <a href="${escapeAttr(p.applicationsUrl)}"
                 style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">
                Xem hồ sơ ứng tuyển
              </a>
            </p>
            <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">
              Nếu bạn không thể tham dự, hãy phản hồi nhà tuyển dụng sớm nhất có thể.
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
    subject: `[IndustrialLink] Mời phỏng vấn — ${p.jobTitle} (${p.scheduledAtLabel})`,
    text,
    html,
  };
}

export function buildInterviewCancelledEmail(p: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  scheduledAtLabel: string;
  applicationsUrl: string;
}): EmailMessage {
  const text = [
    `Xin chào ${p.candidateName},`,
    '',
    `Lịch phỏng vấn cho vị trí «${p.jobTitle}» tại ${p.companyName} (dự kiến ${p.scheduledAtLabel}) đã bị huỷ.`,
    '',
    `Xem chi tiết: ${p.applicationsUrl}`,
    '',
    'Trân trọng,',
    'IndustrialLink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="font-family:Segoe UI,Arial,sans-serif;color:#0F172A;padding:24px">
  <h2 style="color:#DC2626">Lịch phỏng vấn đã bị huỷ</h2>
  <p>Xin chào <strong>${escapeHtml(p.candidateName)}</strong>,</p>
  <p>Buổi PV cho <strong>${escapeHtml(p.jobTitle)}</strong> tại
     <strong>${escapeHtml(p.companyName)}</strong>
     (dự kiến ${escapeHtml(p.scheduledAtLabel)}) đã bị huỷ.</p>
  <p><a href="${escapeAttr(p.applicationsUrl)}" style="color:#2563EB">Xem hồ sơ ứng tuyển</a></p>
</body></html>`;

  return {
    to: p.candidateEmail,
    subject: `[IndustrialLink] Huỷ lịch phỏng vấn — ${p.jobTitle}`,
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
