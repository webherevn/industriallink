'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, Plus, ScrollText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CrmTaxLockStatus } from '@industriallink/contracts';
import { Button, Input } from '@/components/ui';
import { errorText, matchesQuery } from '@/components/crm/format';
import { createMyPartnerClaim, fetchMyPartner } from '@/lib/crm';

const STATUS_META: Record<
  CrmTaxLockStatus,
  { label: string; chip: string }
> = {
  PROTECTING: { label: 'Đang bảo vệ', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  REGISTERED: { label: 'Đã đăng ký', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CONVERTED: { label: 'Đã có đơn', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  EXPIRED: { label: 'Hết hạn', chip: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

export default function CtvTaxLocksPage() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CrmTaxLockStatus | 'all'>('all');

  const add = useMutation({
    mutationFn: () => createMyPartnerClaim({ companyName, taxCode, contactPhone: phone }),
    onSuccess: () => {
      setCompanyName('');
      setTaxCode('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không khóa được mã số thuế')),
  });

  const claims = mine.data?.partner?.claims ?? [];
  const activeCount = claims.filter((claim) => claim.status !== 'EXPIRED').length;

  const rows = useMemo(() => {
    const scoped =
      statusFilter === 'all'
        ? claims
        : claims.filter((claim) => claim.status === statusFilter);
    return scoped.filter((claim) =>
      matchesQuery(query, [claim.companyName, claim.taxCode, claim.contactPhone]),
    );
  }, [claims, query, statusFilter]);

  const limit = 30;

  return (
    <div className="space-y-5">
      {/* Form khóa MST */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#0F2440]">Khóa Mã số thuế khách hàng</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Mỗi mã số thuế thuộc về một cộng tác viên. Giữ 30 ngày kể từ lúc khóa, hết hạn thì tự
                nhả để bạn khóa mã mới.
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Hạn mức
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#0F2440]">
              {activeCount}
              <span className="text-base font-semibold text-slate-400">/{limit}</span>
            </p>
            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#0F2440] transition-all"
                style={{ width: `${Math.min(100, (activeCount / limit) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
          className="mt-4 grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3 sm:grid-cols-4"
        >
          <Input
            placeholder="Tên công ty"
            value={companyName}
            maxLength={160}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
          <Input
            placeholder="Mã số thuế (10 hoặc 13 số)"
            value={taxCode}
            onChange={(event) => setTaxCode(event.target.value)}
            required
          />
          <Input
            placeholder="Số điện thoại liên hệ"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
          </Button>
          {error ? <p className="text-sm text-rose-600 sm:col-span-4">{error}</p> : null}
        </form>
      </section>

      {/* Bảng danh sách MST đã khóa */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Mã số thuế đã khóa</h2>
            <p className="mt-1 text-xs leading-snug text-slate-500">
              {rows.length} mã đang hiện. Mã hết hạn sẽ tự nhả.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'Tất cả'],
                  ['PROTECTING', 'Đang bảo vệ'],
                  ['REGISTERED', 'Đã đăng ký'],
                  ['CONVERTED', 'Đã có đơn'],
                  ['EXPIRED', 'Hết hạn'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    statusFilter === id
                      ? 'bg-[#0F2440] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8 sm:w-56"
                placeholder="Tìm công ty, MST, SĐT"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </div>

        {mine.isLoading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Đang tải danh sách mã số thuế…</p>
        ) : claims.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Chưa khóa mã số thuế nào. Khóa MST để giữ quyền hoa hồng khi khách thanh toán gói.
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Không có mã nào khớp bộ lọc.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Tên công ty</th>
                  <th className="px-5 py-3">Mã số thuế</th>
                  <th className="px-5 py-3">Số điện thoại</th>
                  <th className="px-5 py-3">Ngày khóa</th>
                  <th className="px-5 py-3">Hạn bảo vệ</th>
                  <th className="px-5 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((claim) => {
                  const meta = STATUS_META[claim.status];
                  return (
                    <tr
                      key={claim.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-3 font-medium text-slate-900">{claim.companyName}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700">
                        {claim.taxCode}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{claim.contactPhone}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {formatDate(claim.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {claim.status === 'EXPIRED'
                          ? '—'
                          : `Còn ${claim.daysRemaining} ngày`}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                            meta.chip,
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
