'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CompanyStatus, type AdminCompanyListItem } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchAdminCompanies, updateAdminCompany } from '@/lib/admin-companies';

const TABS: Array<{ value: CompanyStatus | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: CompanyStatus.Active, label: 'Hoạt động' },
  { value: CompanyStatus.Suspended, label: 'Đang treo' },
  { value: CompanyStatus.Banned, label: 'Đã cấm' },
];

const STATUS_LABEL: Record<CompanyStatus, string> = {
  [CompanyStatus.Active]: 'Hoạt động',
  [CompanyStatus.Suspended]: 'Đang treo',
  [CompanyStatus.Banned]: 'Đã cấm',
};

function statusBadge(status: CompanyStatus): string {
  switch (status) {
    case CompanyStatus.Active:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case CompanyStatus.Suspended:
      return 'bg-amber-50 text-amber-800 ring-amber-100';
    case CompanyStatus.Banned:
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
}

function trustTone(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-rose-600';
}

export function AdminCompaniesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CompanyStatus | ''>('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => ({ status: status || undefined, q: q || undefined, page, limit: 50 }),
    [status, q, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies', query],
    queryFn: () => fetchAdminCompanies(query),
  });

  const patchMutation = useMutation({
    mutationFn: (vars: { id: string; status: CompanyStatus; name: string }) =>
      updateAdminCompany(vars.id, { status: vars.status }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-companies'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    },
  });

  const counts = data?.counts;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pendingId = patchMutation.isPending ? patchMutation.variables?.id : undefined;

  function setCompanyStatus(item: AdminCompanyListItem, next: CompanyStatus) {
    const warn =
      next === CompanyStatus.Suspended
        ? `Treo "${item.name}"? Mọi tin đang đăng sẽ bị ẩn.`
        : next === CompanyStatus.Banned
          ? `Cấm "${item.name}"? Mọi tin đang đăng sẽ bị đóng.`
          : `Kích hoạt lại "${item.name}"? Tin đã ẩn/đóng không tự hiện — mở ở Tin tuyển dụng nếu cần.`;
    if (!window.confirm(warn)) return;
    patchMutation.mutate({ id: item.id, status: next, name: item.name });
  }

  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Nền tảng</p>
        <h1 className="cms-page-title mt-1.5">Công ty</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-2xl">
          Danh sách NTD trên nền tảng — treo / cấm, xem thành viên và tin. Đơn xin huy hiệu nằm ở{' '}
          <Link href="/admin/verification" className="font-semibold text-[#E8872A] hover:underline">
            Xác minh NTD
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Tổng" value={counts?.total} />
        <Stat label="Hoạt động" value={counts?.active} tone="emerald" />
        <Stat label="Đang treo" value={counts?.suspended} tone="amber" />
        <Stat label="Đã cấm" value={counts?.banned} tone="rose" />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            className={clsx(
              'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
              status === t.value
                ? 'bg-[#072348] text-white shadow-[0_10px_20px_-12px_rgba(7,35,72,0.9)]'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:text-[#072348]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(qInput.trim());
        }}
      >
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Tìm tên, mã, mã số thuế…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="!rounded-xl hover:!border-[#FFD0A3] hover:!bg-[#FFF8F1]">
          Lọc
        </Button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-2">
          <div className="admin-dash-skel h-12 rounded-xl" />
          <div className="admin-dash-skel h-12 rounded-xl" />
          <div className="admin-dash-skel h-12 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-10 text-center text-sm text-slate-500">
          Không có công ty khớp bộ lọc.
        </div>
      ) : (
        <div className="admin-dash-card mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Công ty</th>
                <th className="px-3 py-2.5">Trust</th>
                <th className="px-3 py-2.5">Trạng thái</th>
                <th className="px-3 py-2.5">Huy hiệu</th>
                <th className="px-3 py-2.5">TV / Tin</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const busy = pendingId === item.id;
                return (
                  <tr key={item.id} className="admin-dash-row">
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/companies/${item.id}`}
                        className="font-semibold text-[#072348] hover:text-[#E8872A]"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {item.code}
                        {item.taxCode ? ` · MST ${item.taxCode}` : ''}
                        {item.industry ? ` · ${item.industry}` : ''}
                      </p>
                    </td>
                    <td className={clsx('px-3 py-3 font-bold', trustTone(item.trustScore))}>
                      {item.trustScore}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1',
                          statusBadge(item.status),
                        )}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-500">
                      {item.verified ? (
                        <span className="mr-1 rounded bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700">
                          Verified
                        </span>
                      ) : null}
                      {item.trustedEmployer ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                          Trusted
                        </span>
                      ) : null}
                      {!item.verified && !item.trustedEmployer ? '—' : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.memberCount} TV · {item.publishedJobCount}/{item.jobCount} đăng
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {item.status !== CompanyStatus.Active ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => setCompanyStatus(item, CompanyStatus.Active)}
                          >
                            Kích hoạt
                          </Button>
                        ) : null}
                        {item.status !== CompanyStatus.Suspended ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => setCompanyStatus(item, CompanyStatus.Suspended)}
                          >
                            Treo
                          </Button>
                        ) : null}
                        {item.status !== CompanyStatus.Banned ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => setCompanyStatus(item, CompanyStatus.Banned)}
                          >
                            Cấm
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.limit ? (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            {data.total} công ty · trang {data.page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value?: number;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  const num = {
    slate: 'text-[#072348]',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }[tone];
  return (
    <Card className="admin-dash-card px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={clsx('mt-0.5 text-xl font-bold', num)}>{value ?? '—'}</p>
    </Card>
  );
}
