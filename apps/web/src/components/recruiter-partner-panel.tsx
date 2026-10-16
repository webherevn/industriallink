'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Copy, Link2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import type { CrmCommissionEntryView, CrmReferralSignupView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { errorText, formatVnd, matchesQuery } from '@/components/crm/format';
import { createMyPartnerClaim, fetchMyPartner, registerMyPartner } from '@/lib/crm';

type HistoryFilter = 'all' | 'month';

export function RecruiterPartnerPanel() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const register = useMutation({
    mutationFn: () => registerMyPartner({ phone }),
    onSuccess: () => {
      setError(null);
      setPhone('');
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không đăng ký được cộng tác viên')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    register.mutate();
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const partner = mine.data?.partner ?? null;
  const entries = mine.data?.commissions ?? [];
  const monthEntries = entries.filter((entry) => inThisMonth(entry.paidAt));
  const monthTotal = sumVnd(monthEntries);

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-accent-600" />
            <h1 className="text-xl font-bold text-slate-900">Cộng tác viên</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Một tài khoản một mã. Hoa hồng ghi khi nhà tuyển dụng đăng ký qua link và thanh toán gói trong 14 ngày.
          </p>
        </div>

        {mine.isLoading ? <Card className="p-5 text-sm text-slate-500">Đang tải mã của bạn…</Card> : null}
        {mine.isError ? <Card className="p-5 text-sm text-rose-600">Không tải được mã giới thiệu.</Card> : null}

        {mine.data && !partner ? (
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Đăng ký làm cộng tác viên</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dùng tên tài khoản đang đăng nhập. Nhập số điện thoại để nhận mã. Không tạo mã thứ hai cho tài khoản này.
            </p>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:max-w-xl sm:flex-row">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? 'Đang tạo mã…' : 'Đăng ký'}
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </Card>
        ) : null}

        {partner && mine.data ? (
          <>
            <Card className="bg-gradient-to-br from-[#072348] to-[#1a4a7a] p-6 text-white">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Số dư ví hoa hồng</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{formatVnd(partner.walletBalanceVnd)}</p>
                  <p className="mt-2 text-sm text-white/75">
                    Mã {partner.code} · {partner.name}
                  </p>
                </div>
                <p className="max-w-xs text-sm leading-relaxed text-white/70">
                  Số dư trên inlink, tự cộng khi khách thanh toán gói. Kỳ đã chốt vẫn nằm trong ví cho đến khi được phép chi.
                </p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Số khoản" value={String(entries.length)} hint="Mỗi đơn đã thanh toán một dòng" />
              <Stat label="Tháng này" value={formatVnd(monthTotal)} hint={`${monthEntries.length} khoản đã cộng vào ví`} />
              <Stat
                label="Tỷ lệ đang áp dụng"
                value={mine.data.commissionPercent == null ? 'Chưa đặt' : `${mine.data.commissionPercent}%`}
                hint="Tỷ lệ trên từng dòng là tỷ lệ lúc khách trả"
              />
              <Stat label="Mã số thuế đã khóa" value={`${partner.claims.length}/30`} hint="Mỗi mã số thuế một cộng tác viên" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="text-base font-semibold text-slate-900">Link giới thiệu</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {partner.phone}. Gửi link này. Cookie giữ 14 ngày, lần bấm sau thay mã và tính lại 14 ngày.
                </p>
                <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="referral-link">
                  Bảng giá
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="referral-link"
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
                    value={partner.referralUrl}
                  />
                  <Button type="button" variant="outline" onClick={() => void copyLink(partner.referralUrl)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Đã chép' : 'Chép link'}
                  </Button>
                </div>
              </Card>
              <Card className="p-5">
                <h2 className="text-base font-semibold text-slate-900">Khi nào có hoa hồng</h2>
                <ol className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>1. Khách mở link, rồi đăng ký tài khoản nhà tuyển dụng.</li>
                  <li>2. Trong 14 ngày kể từ lần bấm, khách thanh toán gói tin hoặc gói Săn có giá.</li>
                  <li>3. Gói Khám phá 0 đồng và nạp Credit không tạo khoản.</li>
                  <li>4. Dòng hiện ở lịch sử bên dưới, trạng thái chờ đối soát.</li>
                </ol>
              </Card>
            </div>

            <Signups rows={partner.signups} />
            <History entries={entries} />
            <TaxLock claims={partner.claims} />
          </>
        ) : null}
      </div>
    </RecruiterShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </Card>
  );
}

function Signups({ rows }: { rows: CrmReferralSignupView[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">Đã đăng ký, chưa thanh toán</h2>
        <p className="mt-1 text-sm text-slate-500">
          {rows.length} nhà tuyển dụng mở link và tạo tài khoản. Hoa hồng chỉ ghi sau khi họ thanh toán gói có giá.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Chưa có tài khoản nào trong hạn cookie mà chưa thanh toán.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate text-sm font-medium text-slate-900">{row.companyName}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatPaidAt(row.registeredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function History({ entries }: { entries: CrmCommissionEntryView[] }) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const scoped = filter === 'month' ? entries.filter((entry) => inThisMonth(entry.paidAt)) : entries;
    return scoped.filter((entry) =>
      matchesQuery(query, [
        entry.companyName,
        entry.planName,
        entry.planCode,
        entry.invoiceNumber,
        entry.billingOrderId,
      ]),
    );
  }, [entries, filter, query]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Lịch sử hoa hồng</h2>
          <p className="mt-1 text-sm text-slate-500">{rows.length} dòng đang hiện. Chỉ đơn đã thanh toán.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1">
            {(
              [
                ['all', 'Tất cả'],
                ['month', 'Tháng này'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  filter === id ? 'bg-[#072348] text-white' : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-56"
            placeholder="Tìm công ty, gói, hóa đơn"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500">Chưa có khoản nào. Hoa hồng xuất hiện sau khi khách thanh toán gói.</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500">Không có khoản khớp bộ lọc.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nhà tuyển dụng</th>
                <th className="px-4 py-3">Gói</th>
                <th className="px-4 py-3">Đã thanh toán</th>
                <th className="px-4 py-3">Tỷ lệ</th>
                <th className="px-4 py-3">Hoa hồng</th>
                <th className="px-4 py-3">Hóa đơn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{entry.companyName}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-400">Đơn {entry.billingOrderId.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
                    {entry.planName ? ` · ${entry.planName}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatVnd(entry.paidAmountVnd)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.percent}%</td>
                  <td className="px-4 py-3 font-semibold text-[#072348]">{formatVnd(entry.commissionVnd)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.invoiceNumber ?? 'Chưa ghi số'}</td>
                  <td className="px-4 py-3">
                    {entry.periodMonth ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Đã chốt kỳ {formatPeriodMonth(entry.periodMonth)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Chờ đối soát</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatPaidAt(entry.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TaxLock({
  claims,
}: {
  claims: Array<{ id: string; companyName: string; taxCode: string }>;
}) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Mã số thuế đã khóa</h2>
      <p className="mt-1 text-sm text-slate-500">
        Khóa mã số thuế của công ty bạn giới thiệu, 10 hoặc 13 số. Mã đó không về cộng tác viên khác. Tối đa 30 mã.
      </p>
      {claims.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-700">
          {claims.map((claim) => (
            <li key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium text-slate-900">{claim.companyName}</span>
              <span className="font-mono text-xs text-slate-500">MST {claim.taxCode}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Chưa khóa mã số thuế nào.</p>
      )}
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-4">
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Tên công ty" value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} required />
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} required />
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Card>
  );
}

function sumVnd(rows: Array<{ commissionVnd: string }>): string {
  return rows.reduce((sum, row) => sum + BigInt(row.commissionVnd || '0'), 0n).toString();
}

function inThisMonth(iso: string): boolean {
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso));
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  return stamp === now;
}

function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  return `${Number(month)}/${year}`;
}

function formatPaidAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
