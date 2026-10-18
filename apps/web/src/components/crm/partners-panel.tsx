'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPartnerView } from '@industriallink/contracts';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd, matchesQuery } from '@/components/crm/format';
import { createCrmPartner, fetchCrmPartners } from '@/lib/crm';

export function currentVietnamMonth(): string {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthTitle(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return 'tháng này';
  return `tháng ${Number(month)}/${year}`;
}

function addVnd(values: string[]): string {
  return values.reduce((sum, value) => sum + BigInt(value || '0'), 0n).toString();
}

export function CrmPartnersPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const qc = useQueryClient();
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const [query, setQuery] = useState(initialQuery);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const month = currentVietnamMonth();

  const add = useMutation({
    mutationFn: () => createCrmPartner({ name, phone }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được cộng tác viên')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  const rows = (partners.data ?? []).filter((partner) =>
    matchesQuery(query, [partner.name, partner.phone, partner.code]),
  );

  return (
    <CrmFrame
      kicker="Người giới thiệu khách"
      title="Cộng tác viên"
      description={`Doanh số ${monthTitle(month)} là tiền khách đã trả qua mã, chưa thuế. Hoa hồng nằm ở ví và chờ đối soát. Bấm một dòng để mở hồ sơ.`}
      placeholder="Tìm tên, số điện thoại hoặc mã"
      search={{ value: query, onChange: setQuery }}
      footnote="Khóa mã số thuế nằm trong hồ sơ. Một mã số thuế chỉ thuộc một cộng tác viên."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-[1fr_1fr_auto]">
        <input className={crmFieldClass} placeholder="Tên cộng tác viên" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <button type="submit" className={crmButtonClass} disabled={add.isPending}>
          {add.isPending ? 'Đang lưu…' : 'Tạo mã'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {partners.isLoading ? <CrmEmpty>Đang tải cộng tác viên…</CrmEmpty> : null}
      {partners.isError ? <CrmEmpty>Không tải được danh sách cộng tác viên.</CrmEmpty> : null}
      {partners.data && partners.data.length === 0 ? <CrmEmpty>Chưa có cộng tác viên.</CrmEmpty> : null}
      {partners.data && partners.data.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có cộng tác viên khớp bộ lọc.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Đang hiện" value={String(rows.length)} hint="Cộng tác viên" />
            <Stat label={`Doanh số ${monthTitle(month)}`} value={formatVnd(addVnd(rows.map((row) => row.monthPaidVnd)))} hint="Tiền khách đã trả" />
            <Stat label="Chờ đối soát" value={formatVnd(addVnd(rows.map((row) => row.pendingCommissionVnd)))} hint="Hoa hồng chưa vào kỳ" />
            <Stat label="Ví hoa hồng" value={formatVnd(addVnd(rows.map((row) => row.walletBalanceVnd)))} hint="Số dư trên inlink" />
          </div>
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#efeaff] text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Cộng tác viên</th>
                    <th className="px-3 py-3 font-semibold">Doanh số {monthTitle(month)}</th>
                    <th className="px-3 py-3 font-semibold">Thông tin nhanh</th>
                    <th className="px-5 py-3 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f0ff]">
                  {rows.map((partner) => (
                    <PartnerRow key={partner.id} partner={partner} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </CrmFrame>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-3.5 crm-surface">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#072348]">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function PartnerRow({ partner }: { partner: CrmPartnerView }) {
  const href = `/crm/partners/${partner.id}`;
  return (
    <tr className="relative transition hover:bg-[#faf8ff]">
      <td className="px-5 py-4">
        <Link href={href} className="font-semibold text-[#072348] after:absolute after:inset-0">
          {partner.name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">{partner.phone} · {partner.code}</p>
        <p className="mt-0.5 text-xs text-slate-400">{partner.fromAccount ? 'Nhà tuyển dụng tự đăng ký' : 'CRM tạo hộ'}</p>
      </td>
      <td className="px-3 py-4">
        <p className="font-semibold text-[#072348]">{formatVnd(partner.monthPaidVnd)}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Gói tin {formatVnd(partner.monthPlatformPaidVnd)} · Gói Săn {formatVnd(partner.monthSourcingPaidVnd)}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{partner.monthOrderCount} đơn · {partner.monthCompanyCount} công ty</p>
      </td>
      <td className="px-3 py-4">
        <div className="flex max-w-md flex-wrap gap-1.5">
          <Fact label="Lead" value={String(partner.leadCount)} />
          <Fact label="Chưa trả" value={String(partner.signups.length)} />
          <Fact label="MST" value={String(partner.claims.length)} />
          <Fact label="Ví" value={formatVnd(partner.walletBalanceVnd)} />
          <Fact label="Chờ đối soát" value={formatVnd(partner.pendingCommissionVnd)} />
        </div>
      </td>
      <td className="relative z-10 px-5 py-4 text-right">
        <Link href={href} className={crmActionClass}>Hồ sơ</Link>
      </td>
    </tr>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-full bg-[#f6f4ff] px-2.5 py-1 text-xs text-slate-500">
      {label}
      <span className="font-semibold text-[#072348]">{value}</span>
    </span>
  );
}
