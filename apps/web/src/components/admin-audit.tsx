'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Input } from '@/components/ui';
import { fetchAuditLog } from '@/lib/admin-audit';

const ENTITY_TYPES = ['', 'user', 'company', 'job', 'application', 'interview', 'offer', 'onboarding'];

const ACTION_LABEL: Record<string, string> = {
  'user.register': 'Đăng ký tài khoản',
  'user.login_mfa_challenge': 'Đăng nhập — chờ MFA',
  'user.resend_otp': 'Gửi lại OTP',
  'user.resend_login_otp': 'Gửi lại OTP đăng nhập',
  'user.totp_enable': 'Bật TOTP',
  'user.totp_disable': 'Tắt TOTP',
  'user.mfa_enable': 'Bật MFA',
  'company.create': 'Tạo công ty',
  'company.update': 'Sửa hồ sơ công ty',
  'company.invite_member': 'Mời thành viên',
  'company.remove_member': 'Gỡ thành viên',
  'company.admin.update': 'SuperAdmin sửa công ty',
  'company.verification.request': 'NTD xin xác minh',
  'company.verification.approve': 'Duyệt xác minh NTD',
  'company.verification.reject': 'Từ chối xác minh NTD',
  'job.create': 'Tạo tin tuyển dụng',
  'job.ai_draft': 'AI soạn tin',
  'job.ai_parse_text': 'AI đọc JD',
  'job.ai_parse_file': 'AI đọc file JD',
  'job.admin.hide': 'Ẩn tin',
  'job.admin.unhide': 'Hiện lại tin',
  'job.admin.close': 'Đóng tin',
  'job.admin.requeue': 'Đẩy tin vào hàng duyệt',
  'application.create': 'Nộp hồ sơ',
  'application.status': 'Đổi trạng thái hồ sơ',
  'job.broadcast_email': 'Gửi email hàng loạt',
  'interview.schedule': 'Đặt lịch phỏng vấn',
  'interview.update': 'Cập nhật phỏng vấn',
  'offer.create': 'Tạo offer',
  'offer.update': 'Cập nhật offer',
  'offer.respond': 'Phản hồi offer',
  'onboarding.start': 'Bắt đầu nhận việc',
  'onboarding.update': 'Cập nhật nhận việc',
};

export function AdminAuditPage() {
  const [entityType, setEntityType] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const query = useMemo(() => ({ entityType: entityType || undefined, q: q || undefined, page, limit: 40 }), [entityType, q, page]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', query],
    queryFn: () => fetchAuditLog(query),
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <AdminShell>
      <div>
        <h1 className="cms-page-title flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-brand-600" />
          Nhật ký
        </h1>
        <p className="cms-page-subtitle">
          Các thay đổi đã ghi: đăng ký, công ty, tin, hồ sơ, phỏng vấn, offer. Chỉ SuperAdmin đọc được.
        </p>
      </div>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(qInput.trim());
        }}
      >
        <select
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi đối tượng</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          className="max-w-xs"
          placeholder="Hành động, email, mã…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <Button type="submit">Lọc</Button>
      </form>

      <Card className="mt-4 overflow-x-auto !p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Đang tải…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Chưa có bản ghi khớp bộ lọc.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Thời điểm</th>
                <th className="px-4 py-3 font-semibold">Ai</th>
                <th className="px-4 py-3 font-semibold">Việc</th>
                <th className="px-4 py-3 font-semibold">Đối tượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => {
                const open = openId === row.id;
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-3 text-xs text-slate-500" colSpan={open ? 4 : undefined}>
                      {open ? (
                        <div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand-600"
                            onClick={() => setOpenId(null)}
                          >
                            Thu gọn
                          </button>
                          <p className="mt-2 text-xs text-slate-500">
                            {new Date(row.createdAt).toLocaleString('vi-VN')} · {row.actorEmail || row.actorName || 'hệ thống'} ·{' '}
                            {ACTION_LABEL[row.action] ?? row.action}
                          </p>
                          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
                            {JSON.stringify({ before: row.before, after: row.after, ip: row.ip, correlationId: row.correlationId }, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <button type="button" className="text-left hover:text-brand-600" onClick={() => setOpenId(row.id)}>
                          {new Date(row.createdAt).toLocaleString('vi-VN')}
                        </button>
                      )}
                    </td>
                    {!open && (
                      <>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {row.actorName || row.actorEmail || '—'}
                          {row.actorEmail && row.actorName ? (
                            <span className="block text-slate-400">{row.actorEmail}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-left font-medium text-slate-800 hover:text-brand-600" onClick={() => setOpenId(row.id)}>
                            {ACTION_LABEL[row.action] ?? row.action}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {row.entityType}
                          {row.entityId ? <span className="block truncate max-w-[180px]">{row.entityId}</span> : null}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {data && data.total > data.limit && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </Button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
