import type { EmailMessage } from './email.types';

export type JobModerationEmailOutcome = 'approved' | 'rejected' | 'banned';

const COPY: Record<
  JobModerationEmailOutcome,
  { heading: string; subject: string; lead: string; cta: string; color: string }
> = {
  approved: {
    heading: 'Tin tuyển dụng đã được duyệt',
    subject: 'Tin đã được duyệt',
    lead: 'đã qua kiểm duyệt và đang hiển thị công khai trên inlink.',
    cta: 'Xem tin tuyển dụng',
    color: '#1E3A8A,#2563EB',
  },
  rejected: {
    heading: 'Tin tuyển dụng chưa được duyệt',
    subject: 'Tin chưa được duyệt',
    lead: 'chưa được duyệt nên chưa hiển thị công khai. Vui lòng chỉnh sửa theo lý do bên dưới rồi gửi đăng lại.',
    cta: 'Quản lý tin tuyển dụng',
    color: '#9A3412,#EA580C',
  },
  banned: {
    heading: 'Tin tuyển dụng bị gỡ do vi phạm',
    subject: 'Tin bị gỡ do vi phạm',
    lead: 'đã bị gỡ do vi phạm quy định đăng tin, và tài khoản đăng tin đã bị khoá.',
    cta: 'Liên hệ inlink',
    color: '#7F1D1D,#DC2626',
  },
};

export function buildJobModerationResultEmail(p: {
  to: string;
  displayName: string;
  jobTitle: string;
  outcome: JobModerationEmailOutcome;
  reason?: string | null;
  url: string;
}): EmailMessage {
  const c = COPY[p.outcome];
  const reason = p.outcome === 'approved' ? null : p.reason?.trim() || null;

  const text = [
    `Xin chào ${p.displayName},`,
    '',
    `Tin «${p.jobTitle}» ${c.lead}`,
    ...(reason ? ['', `Lý do: ${reason}`] : []),
    '',
    `${c.cta}: ${p.url}`,
    '',
    'Trân trọng,',
    'inlink',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="vi"><body style="margin:0;padding:24px;background:#F8FAFC;font-family:Segoe UI,Arial,sans-serif;color:#0F172A">
  <table width="560" style="margin:0 auto;background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,${c.color});padding:24px;color:#fff">
      <div style="font-size:13px;opacity:.9">inlink</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">${esc(c.heading)}</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 12px">Xin chào <strong>${esc(p.displayName)}</strong>,</p>
      <p style="margin:0 0 18px;color:#334155">Tin <strong>${esc(p.jobTitle)}</strong> ${esc(c.lead)}</p>
      ${
        reason
          ? `<p style="margin:0 0 18px;padding:12px 14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;color:#7C2D12;font-size:14px"><strong>Lý do:</strong> ${esc(reason)}</p>`
          : ''
      }
      <p style="margin:0">
        <a href="${escAttr(p.url)}" style="display:inline-block;background:#1D4ED8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600">
          ${esc(c.cta)}
        </a>
      </p>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: p.to,
    subject: `[inlink] ${c.subject} — ${p.jobTitle}`,
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
