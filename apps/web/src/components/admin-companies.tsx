'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CompanyStatus, type AdminCompanyListItem } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Input } from '@/components/ui';
import {
  assignAdminCompanyPlan,
  assignAdminCompanySourcingPlan,
  fetchAdminPlatformPlans,
  fetchAdminSourcingPlans,
  unassignAdminCompanySourcingPlan,
} from '@/lib/admin-billing';
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
  const [picking, setPicking] = useState<AdminCompanyListItem | null>(null);

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
                <th className="px-3 py-2.5">Gói đăng ký</th>
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
                      <div className="flex max-w-[220px] flex-col items-start gap-1">
                        <PlanTag label={item.platformPlanName} empty="Chưa gán gói tin" />
                        <PlanTag label={item.sourcingPlanName} empty="Chưa gán gói Săn" muted />
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-[#E8872A] hover:underline"
                          onClick={() => setPicking(item)}
                        >
                          Chọn gói
                        </button>
                      </div>
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

      {picking ? (
        <PlanPicker
          company={picking}
          onClose={() => setPicking(null)}
          onSaved={async () => {
            setPicking(null);
            setError(null);
            await qc.invalidateQueries({ queryKey: ['admin-companies'] });
          }}
          onError={(message) => setError(message)}
        />
      ) : null}
    </AdminShell>
  );
}

function PlanTag({ label, empty, muted = false }: { label: string | null; empty: string; muted?: boolean }) {
  if (!label) {
    return <span className="text-[11px] text-slate-400">{empty}</span>;
  }
  return (
    <span
      className={clsx(
        'inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1',
        muted
          ? 'bg-violet-50 text-violet-800 ring-violet-100'
          : 'bg-sky-50 text-sky-800 ring-sky-100',
      )}
    >
      {label}
    </span>
  );
}

function PlanPicker({
  company,
  onClose,
  onSaved,
  onError,
}: {
  company: AdminCompanyListItem;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const { data: platforms, isLoading: loadingPlatforms } = useQuery({
    queryKey: ['admin-billing-platform-plans', 'active'],
    queryFn: () => fetchAdminPlatformPlans(false),
  });
  const { data: sourcings, isLoading: loadingSourcing } = useQuery({
    queryKey: ['admin-billing-sourcing-plans', 'active'],
    queryFn: () => fetchAdminSourcingPlans(false),
  });
  const activePlatforms = (platforms ?? []).filter((p) => p.isActive);
  const activeSourcing = (sourcings ?? []).filter((p) => p.isActive);
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [sourcingId, setSourcingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPlatform =
    platformId ??
    activePlatforms.find((p) => p.code === company.platformPlanCode)?.id ??
    activePlatforms.find((p) => p.code === 'KHAM_PHA')?.id ??
    activePlatforms[0]?.id ??
    '';
  const selectedSourcing =
    sourcingId ??
    (company.sourcingPlanCode
      ? (activeSourcing.find((p) => p.code === company.sourcingPlanCode)?.id ?? '')
      : '');

  async function save() {
    if (!selectedPlatform) {
      onError('Chưa có gói nền tảng đang bật để gán.');
      return;
    }
    setSaving(true);
    try {
      await assignAdminCompanyPlan({
        companyId: company.id,
        planId: selectedPlatform,
        isActive: true,
        note: 'SuperAdmin gán từ danh sách công ty',
      });
      if (selectedSourcing) {
        await assignAdminCompanySourcingPlan({
          companyId: company.id,
          planId: selectedSourcing,
          isActive: true,
          note: 'SuperAdmin gán từ danh sách công ty',
        });
      } else if (company.sourcingPlanCode) {
        await unassignAdminCompanySourcingPlan(company.id);
      }
      await onSaved();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Gán gói thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#E8872A]">Gói đăng ký</p>
            <h2 className="mt-1 text-lg font-bold text-[#072348]">{company.name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Tick một gói tin và, nếu cần, một gói Săn. Lưu là gán ngay cho NTD.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingPlatforms || loadingSourcing ? (
          <div className="admin-dash-skel mt-4 h-24" />
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gói tin đăng</legend>
              <div className="mt-2 space-y-1.5">
                {activePlatforms.map((plan) => (
                  <label key={plan.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="platform-plan"
                      checked={selectedPlatform === plan.id}
                      onChange={() => setPlatformId(plan.id)}
                    />
                    <span className="text-sm font-medium text-slate-800">{plan.name}</span>
                    <span className="text-[11px] text-slate-400">{plan.code}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gói Săn</legend>
              <div className="mt-2 space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="sourcing-plan"
                    checked={selectedSourcing === ''}
                    onChange={() => setSourcingId('')}
                  />
                  <span className="text-sm text-slate-700">Không gán gói Săn</span>
                </label>
                {activeSourcing.map((plan) => (
                  <label key={plan.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="sourcing-plan"
                      checked={selectedSourcing === plan.id}
                      onChange={() => setSourcingId(plan.id)}
                    />
                    <span className="text-sm font-medium text-slate-800">{plan.name}</span>
                    <span className="text-[11px] text-slate-400">{plan.code}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !selectedPlatform}>
            {saving ? 'Đang gán…' : 'Gán gói'}
          </Button>
        </div>
      </div>
    </div>
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
