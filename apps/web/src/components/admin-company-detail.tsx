'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CompanyRole,
  CompanyStatus,
  JobStatus,
  type UpdateAdminCompanyRequest,
} from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchAdminCompany, updateAdminCompany } from '@/lib/admin-companies';
import { companyPublicPath, siteUrl } from '@/lib/public-paths';

const STATUS_LABEL: Record<CompanyStatus, string> = {
  [CompanyStatus.Active]: 'Hoạt động',
  [CompanyStatus.Suspended]: 'Đang treo',
  [CompanyStatus.Banned]: 'Đã cấm',
};

const ROLE_LABEL: Record<CompanyRole, string> = {
  [CompanyRole.Owner]: 'Chủ sở hữu',
  [CompanyRole.Admin]: 'Admin',
  [CompanyRole.Member]: 'Thành viên',
};

const JOB_STATUS: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'Nháp',
  [JobStatus.Published]: 'Đang đăng',
  [JobStatus.Paused]: 'Đang ẩn',
  [JobStatus.Closed]: 'Đã đóng',
};

export function AdminCompanyDetailPage({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-company', companyId],
    queryFn: () => fetchAdminCompany(companyId),
  });

  const [trust, setTrust] = useState('50');
  const [verified, setVerified] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setTrust(String(data.trustScore));
    setVerified(data.verified);
    setTrusted(data.trustedEmployer);
  }, [data]);

  const patchMutation = useMutation({
    mutationFn: (body: UpdateAdminCompanyRequest) => updateAdminCompany(companyId, body),
    onSuccess: (view) => {
      qc.setQueryData(['admin-company', companyId], view);
      void qc.invalidateQueries({ queryKey: ['admin-companies'] });
      setBanner({ tone: 'ok', text: 'Đã lưu.' });
    },
    onError: (err) => {
      setBanner({ tone: 'err', text: err instanceof ApiError ? err.message : 'Lưu thất bại' });
    },
  });

  if (isLoading || !data) {
    return (
      <AdminShell>
        <p className="mt-6 text-sm text-slate-500">Đang tải hồ sơ công ty…</p>
      </AdminShell>
    );
  }

  const publicHref = `${siteUrl()}${companyPublicPath(data)}`;

  return (
    <AdminShell>
      <Link
        href="/admin/companies"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách công ty
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            {data.name}
          </h1>
          <p className="cms-page-subtitle">
            <span className="font-mono">{data.code}</span>
            {data.taxCode ? ` · MST ${data.taxCode}` : ''}
            {data.industry ? ` · ${data.industry}` : ''}
            {' · '}
            <a href={publicHref} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Trang công khai
            </a>
          </p>
        </div>
        <span
          className={clsx(
            'rounded-lg px-2.5 py-1 text-[13px] font-semibold ring-1',
            data.status === CompanyStatus.Active
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
              : data.status === CompanyStatus.Suspended
                ? 'bg-amber-50 text-amber-800 ring-amber-100'
                : 'bg-rose-50 text-rose-700 ring-rose-100',
          )}
        >
          {STATUS_LABEL[data.status]}
        </span>
      </div>

      {banner ? (
        <p
          className={clsx(
            'mt-4 rounded-lg border px-3 py-2 text-sm',
            banner.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {banner.text}
        </p>
      ) : null}

      <Card className="mt-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Vận hành</h2>
        <div className="flex flex-wrap gap-2">
          {data.status !== CompanyStatus.Active ? (
            <Button
              type="button"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={() => {
                if (window.confirm('Kích hoạt lại công ty? Tin cũ không tự hiện.')) {
                  patchMutation.mutate({ status: CompanyStatus.Active });
                }
              }}
            >
              Kích hoạt
            </Button>
          ) : null}
          {data.status !== CompanyStatus.Suspended ? (
            <Button
              type="button"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={() => {
                if (window.confirm('Treo công ty? Tin đang đăng sẽ bị ẩn.')) {
                  patchMutation.mutate({ status: CompanyStatus.Suspended });
                }
              }}
            >
              Treo
            </Button>
          ) : null}
          {data.status !== CompanyStatus.Banned ? (
            <Button
              type="button"
              variant="outline"
              disabled={patchMutation.isPending}
              onClick={() => {
                if (window.confirm('Cấm công ty? Tin đang đăng sẽ bị đóng.')) {
                  patchMutation.mutate({ status: CompanyStatus.Banned });
                }
              }}
            >
              Cấm
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Điểm tín nhiệm (0–100)" description="Mặc định 50. +1 mỗi tin hợp lệ, −10 nếu bị report.">
            <Input
              type="number"
              min={0}
              max={100}
              value={trust}
              onChange={(e) => setTrust(e.target.value)}
            />
          </Field>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
              Verified (đã xác minh)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />
              Trusted employer
            </label>
          </div>
        </div>
        <Button
          type="button"
          disabled={patchMutation.isPending}
          onClick={() =>
            patchMutation.mutate({
              trustScore: Number(trust),
              verified,
              trustedEmployer: trusted,
            })
          }
        >
          Lưu trust & huy hiệu
        </Button>
        {data.address || data.website || data.description ? (
          <p className="text-sm text-slate-500">
            {data.address}
            {data.website ? ` · ${data.website}` : ''}
            {data.description ? ` — ${data.description.slice(0, 180)}` : ''}
          </p>
        ) : null}
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Thành viên ({data.members.length})
        </h2>
        {data.members.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có thành viên.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1.5 pr-3">Tên</th>
                <th className="py-1.5 pr-3">Email</th>
                <th className="py-1.5 pr-3">Vai trò</th>
                <th className="py-1.5">Tài khoản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 font-medium text-slate-800">{m.displayName}</td>
                  <td className="py-2 pr-3 text-slate-600">{m.email}</td>
                  <td className="py-2 pr-3">{ROLE_LABEL[m.roleInCompany] ?? m.roleInCompany}</td>
                  <td className="py-2 text-slate-500">{m.userStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-4 overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Tin tuyển dụng ({data.jobs.length})</h2>
          <Link href="/admin/jobs" className="text-xs font-semibold text-brand-600 hover:underline">
            Mở console tin
          </Link>
        </div>
        {data.jobs.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có tin.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1.5 pr-3">Tin</th>
                <th className="py-1.5 pr-3">Trạng thái</th>
                <th className="py-1.5">Kiểm duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.jobs.map((j) => (
                <tr key={j.id}>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-800">{j.title}</p>
                    <p className="font-mono text-[11px] text-slate-400">{j.code}</p>
                  </td>
                  <td className="py-2 pr-3">{JOB_STATUS[j.status] ?? j.status}</td>
                  <td className="py-2 text-slate-500">{j.moderationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}
