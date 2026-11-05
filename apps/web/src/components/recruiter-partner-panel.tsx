'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CalendarDays,
  Check,
  ClipboardList,
  Coins,
  Copy,
  FileText,
  Laptop,
  Layers,
  Link2,
  Megaphone,
  Percent,
} from 'lucide-react';
import { FormEvent, useMemo, useState, type ReactNode } from 'react';
import type { CrmCommissionEntryView, CrmReferralSignupView, CrmWalletTxnView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card, Input } from '@/components/ui';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
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
      <div className="ntd-form recruiter-dash space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-800">Cộng tác viên</h1>
            <p className="mt-1 text-sm text-slate-500">
              Một tài khoản một mã. Hoa hồng ghi khi nhà tuyển dụng đăng ký qua link và thanh toán gói trong 14 ngày.
            </p>
          </div>
        </div>

        {mine.isLoading ? <Card className="p-5 text-sm text-slate-500">Đang tải mã của bạn…</Card> : null}
        {mine.isError ? <Card className="p-5 text-sm text-rose-600">Không tải được mã giới thiệu.</Card> : null}

        {mine.data && !partner ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
            <h2 className="text-sm font-bold text-brand-800">Đăng ký làm cộng tác viên</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dùng tên tài khoản đang đăng nhập. Nhập số điện thoại để nhận mã. Không tạo mã thứ hai cho tài khoản này.
            </p>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
              <Input
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
          </section>
        ) : null}

        {partner && mine.data ? (
          <>
            <section className="brand-hero-surface relative rounded-2xl p-5 sm:p-6">
              <div className="relative grid items-center gap-5 lg:grid-cols-[minmax(0,16rem)_1px_minmax(0,1fr)]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Số dư ví hoa hồng</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    {formatVnd(partner.walletBalanceVnd)}
                  </p>
                  <p className="mt-2 text-sm text-white/75">
                    Mã {partner.code} - {partner.name}
                  </p>
                </div>
                <div className="hidden h-16 bg-white/20 lg:block" />
                <div className="flex items-center justify-between gap-4">
                  <p className="max-w-sm text-sm leading-relaxed text-white/75">
                    Số dư trên inlink, tự cộng khi khách thanh toán gói. Kỳ đã chốt vẫn nằm trong ví. Kế toán ghi đã chi vào ngày {mine.data.payoutDay ?? 10} hàng tháng.
                  </p>
                  <WalletMark />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                icon={<Layers className="h-5 w-5" />}
                tone="bg-brand-50 text-brand-700"
                label="Số khoản"
                value={String(entries.length)}
                hint="Mỗi đơn đã thanh toán một dòng"
              />
              <Stat
                icon={<CalendarDays className="h-5 w-5" />}
                tone="bg-accent-50 text-accent-700"
                label="Tháng này"
                value={formatVnd(monthTotal)}
                hint={`${monthEntries.length} khoản đã cộng vào ví`}
                valueClass="text-[#E8872A]"
              />
              <Stat
                icon={<Percent className="h-5 w-5" />}
                tone="bg-emerald-50 text-emerald-700"
                label="Tỷ lệ đang áp dụng"
                value={mine.data.commissionPercent == null ? 'Chưa đặt' : `${mine.data.commissionPercent}%`}
                hint="Tỷ lệ trên từng dòng là tỷ lệ lúc khách trả"
                valueClass="text-[#E8872A]"
              />
              <Stat
                icon={<FileText className="h-5 w-5" />}
                tone="bg-[#e7eef8] text-brand-700"
                label="Mã số thuế đã khóa"
                value={`${partner.claims.length}/30`}
                hint="Mỗi mã số thuế một cộng tác viên"
              />
            </div>

            <WalletStatement rows={mine.data.walletTxns ?? []} />

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-accent-100 bg-white p-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-brand-800">Link giới thiệu</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {partner.phone}. Gửi link này. Cookie giữ 14 ngày, lần bấm sau thay mã và tính lại 14 ngày.
                    </p>
                  </div>
                </div>
                <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="referral-link">
                  Bảng giá
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <Input id="referral-link" readOnly value={partner.referralUrl} />
                  <Button type="button" variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => void copyLink(partner.referralUrl)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Đã chép' : 'Chép link'}
                  </Button>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                        i
                      </span>
                      <h2 className="text-sm font-bold text-brand-800">Khi nào có hoa hồng</h2>
                    </div>
                    <ol className="mt-4 space-y-3">
                      {[
                        'Khách mở link, rồi đăng ký tài khoản nhà tuyển dụng.',
                        'Trong 14 ngày kể từ lần bấm, khách thanh toán gói tin hoặc gói Săn có giá.',
                        'Gói Khám phá 0 đồng và nạp Credit không tạo khoản.',
                        'Dòng hiện ở lịch sử bên dưới, trạng thái chờ đối soát.',
                      ].map((step, index) => (
                        <li key={step} className="flex items-start gap-3 text-sm text-slate-600">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <CalendarDays aria-hidden className="mt-8 hidden h-16 w-16 shrink-0 text-accent-200 lg:block" strokeWidth={1.1} />
                </div>
              </section>
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

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
  valueClass = 'text-[#E8872A]',
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-200">
      <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl transition duration-300 group-hover:scale-110', tone)}>
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className={clsx('mt-1 text-3xl font-bold tabular-nums tracking-tight', valueClass)}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
      <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 h-16 w-24 rounded-full bg-brand-50/80" />
    </div>
  );
}

function WalletMark() {
  return (
    <div aria-hidden className="relative hidden h-28 w-40 shrink-0 sm:block">
      <Laptop className="absolute bottom-1 left-1 h-16 w-16 text-white/80" strokeWidth={1.15} />
      <span className="absolute left-7 top-2 flex h-11 w-14 items-center justify-center rounded-xl bg-white text-sm font-black tracking-tight text-brand-800 shadow-lg">
        iL
      </span>
      <Megaphone className="absolute right-1 top-0 h-9 w-9 -rotate-12 text-white" strokeWidth={1.4} />
      <Coins className="absolute bottom-5 right-7 h-7 w-7 text-accent-300" />
      <span className="absolute bottom-1 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-white shadow">
        <Percent className="h-4 w-4" />
      </span>
    </div>
  );
}

function Signups({ rows }: { rows: CrmReferralSignupView[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-brand-800">Đã đăng ký, chưa thanh toán</h2>
        <p className="mt-1 text-sm text-slate-500">
          {rows.length} nhà tuyển dụng mở link và tạo tài khoản. Hoa hồng chỉ ghi sau khi họ thanh toán gói có giá.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Chưa có tài khoản nào trong hạn cookie mà chưa thanh toán.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-brand-50/40">
              <span className="min-w-0 truncate text-sm font-medium text-slate-900">{row.companyName}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatPaidAt(row.registeredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-800">Lịch sử hoa hồng</h2>
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
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition duration-200',
                  filter === id ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-brand-100 hover:bg-brand-50',
                )}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            className="sm:w-56"
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
            <thead className="bg-brand-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-700">
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
                <tr key={entry.id} className="border-t border-slate-100 transition hover:bg-brand-50/40">
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
                    {entry.periodStatus === 'paid' && entry.periodMonth ? (
                      <span className="rounded-full bg-[#efeaff] px-2.5 py-1 text-xs font-semibold text-[#4c3ec9]">
                        Đã chi kỳ {formatPeriodMonth(entry.periodMonth)}
                      </span>
                    ) : entry.periodMonth ? (
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
    </section>
  );
}

function WalletStatement({ rows }: { rows: CrmWalletTxnView[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-brand-800">Sao kê ví</h2>
          <p className="mt-1 text-sm text-slate-500">Cộng khi khách thanh toán gói. Trừ khi kế toán ghi đã chi. Không phải ví MoMo.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-400">
            <FileText className="h-8 w-8" strokeWidth={1.4} />
          </span>
          <p className="mt-3 text-sm text-slate-500">Chưa có dòng nào trong ví.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-brand-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3">Phát sinh</th>
                <th className="px-4 py-3">Số dư sau dòng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 transition hover:bg-brand-50/40">
                  <td className="px-4 py-3 text-xs text-slate-500">{formatWhen(row.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-800">{row.label}</td>
                  <td className={`px-4 py-3 font-semibold ${row.kind === 'debit' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {row.kind === 'debit' ? '−' : '+'}
                    {formatVnd(row.amountVnd)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{formatVnd(row.balanceAfterVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-brand-800">Mã số thuế đã khóa</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Khóa mã số thuế của công ty bạn giới thiệu, 10 hoặc 13 số. Mã đó không về cộng tác viên khác. Tối đa 30 mã.
        </p>
      </div>
      <div className="p-5">
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
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3 sm:grid-cols-4">
        <Input placeholder="Tên công ty" value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} required />
        <Input placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} required />
        <Input placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    </section>
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
