'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPartnerPaidOrderView, CrmPartnerView } from '@industriallink/contracts';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmMonthField } from '@/components/crm/fields';
import { errorText, formatVnd, formatWhen } from '@/components/crm/format';
import { currentVietnamMonth, monthTitle } from '@/components/crm/partners-panel';
import { createCrmPartnerClaim, fetchCrmPartner } from '@/lib/crm';

const CLAIM_LIMIT = 30;

export function CrmPartnerProfilePanel({ partnerId }: { partnerId: string }) {
  const [month, setMonth] = useState(currentVietnamMonth);
  const profile = useQuery({
    queryKey: ['crm-partner', partnerId, month],
    queryFn: () => fetchCrmPartner(partnerId, month),
  });
  const partner = profile.data?.partner;

  return (
    <CrmFrame
      kicker="Hồ sơ cộng tác viên"
      title={partner?.name ?? 'Hồ sơ cộng tác viên'}
      description={partner ? `${partner.phone} · ${partner.code} · ${partner.fromAccount ? 'Nhà tuyển dụng tự đăng ký' : 'CRM tạo hộ'}` : 'Doanh số là tiền khách đã trả qua mã.'}
      footnote="Doanh số là đơn gói đã trả, giá lớn hơn 0, chưa VAT. Hoa hồng nằm ở ví và chờ đối soát."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/crm/partners" className="text-sm font-semibold text-[#4c3ec9]">
          Về danh sách
        </Link>
        <CrmMonthField value={month} onChange={setMonth} max={currentVietnamMonth()} />
      </div>
      {profile.isLoading ? <CrmEmpty>Đang tải hồ sơ…</CrmEmpty> : null}
      {profile.isError ? <CrmEmpty>{errorText(profile.error, 'Không tải được hồ sơ cộng tác viên.')}</CrmEmpty> : null}
      {partner && profile.data ? (
        <div className="space-y-4">
          <Identity partner={partner} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={`Doanh số ${monthTitle(profile.data.periodMonth)}`} value={formatVnd(partner.monthPaidVnd)} hint={`${partner.monthOrderCount} đơn · ${partner.monthCompanyCount} công ty`} />
            <Stat label="Gói tin" value={formatVnd(partner.monthPlatformPaidVnd)} hint="Tiền khách đã trả" />
            <Stat label="Gói Săn" value={formatVnd(partner.monthSourcingPaidVnd)} hint="Tiền khách đã trả" />
            <Stat label="Chờ đối soát" value={formatVnd(partner.pendingCommissionVnd)} hint={`${partner.pendingCount} khoản hoa hồng`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Ví hoa hồng" value={formatVnd(partner.walletBalanceVnd)} hint="Số dư trên inlink" />
            <Stat label="Lead" value={String(partner.leadCount)} hint="Còn hiệu lực" />
            <Stat label="Đăng ký chưa trả" value={String(partner.signups.length)} hint="Chưa mua gói có giá" />
            <Stat label="Mã số thuế" value={`${partner.claims.length}/${CLAIM_LIMIT}`} hint="Đã khóa" />
          </div>
          <Orders orders={profile.data.orders} periodMonth={profile.data.periodMonth} />
          <Signups partner={partner} />
          <Claims partner={partner} />
        </div>
      ) : null}
    </CrmFrame>
  );
}

function Identity({ partner }: { partner: CrmPartnerView }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(partner.referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-[22px] bg-white p-5 crm-surface">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Mã giới thiệu</p>
          <p className="mt-1 font-mono text-lg font-semibold text-[#072348]">{partner.code}</p>
          <p className="mt-1 break-all text-sm text-slate-600">{partner.referralUrl}</p>
          <p className="mt-1 text-xs text-slate-400">Tạo ngày {formatDay(partner.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={crmActionClass} onClick={() => void copyLink()}>
            {copied ? 'Đã chép link' : 'Chép link'}
          </button>
          <Link href={`/crm/signups?q=${encodeURIComponent(partner.code)}`} className={crmActionClass}>
            Đăng ký chưa trả
          </Link>
          <Link href={`/crm/finance/reconciliation?q=${encodeURIComponent(partner.code)}`} className={crmActionClass}>
            Xem đối soát
          </Link>
        </div>
      </div>
    </section>
  );
}

function Orders({ orders, periodMonth }: { orders: CrmPartnerPaidOrderView[]; periodMonth: string }) {
  return (
    <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
      <div className="border-b border-[#efeaff] px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Đơn đã trả {monthTitle(periodMonth)}</h2>
        <p className="mt-1 text-xs text-slate-500">Tiền khách đã trả qua mã này. Không phải hoa hồng.</p>
      </div>
      {orders.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">Tháng này chưa có đơn đã trả.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#efeaff] text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Công ty</th>
                <th className="px-3 py-3 font-semibold">Gói</th>
                <th className="px-3 py-3 font-semibold">Đã trả</th>
                <th className="px-5 py-3 font-semibold">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f0ff]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3.5">
                    <Link href={`/crm/companies/${order.companyId}`} className="font-semibold text-[#4c3ec9]">
                      {order.companyName}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    {order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'} · {order.planName}
                  </td>
                  <td className="px-3 py-3.5 font-semibold text-[#072348]">{formatVnd(order.paidAmountVnd)}</td>
                  <td className="px-5 py-3.5 text-slate-500">{formatWhen(order.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Signups({ partner }: { partner: CrmPartnerView }) {
  return (
    <section className="rounded-[22px] bg-white p-5 crm-surface">
      <h2 className="text-sm font-semibold text-slate-900">Đăng ký chưa trả</h2>
      <p className="mt-1 text-xs text-slate-500">Nhà tuyển dụng đến từ mã này và chưa mua gói có giá.</p>
      {partner.signups.length === 0 ? <p className="mt-3 text-sm text-slate-500">Không có đăng ký đang chờ.</p> : (
        <ul className="mt-3 divide-y divide-[#f3f0ff]">
          {partner.signups.map((signup) => (
            <li key={signup.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm text-slate-700">
              <span className="font-medium text-[#072348]">{signup.companyName}</span>
              <span className="text-xs text-slate-500">Đăng ký {formatWhen(signup.registeredAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Claims({ partner }: { partner: CrmPartnerView }) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = partner.claims.length >= CLAIM_LIMIT;
  const add = useMutation({
    mutationFn: () => createCrmPartnerClaim(partner.id, { companyName, taxCode, contactPhone: phone }),
    onSuccess: () => {
      setCompanyName('');
      setTaxCode('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-partner'] });
      void qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không khóa được mã số thuế')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  return (
    <section className="rounded-[22px] bg-white p-5 crm-surface">
      <h2 className="text-sm font-semibold text-slate-900">Mã số thuế đã khóa</h2>
      <p className="mt-1 text-xs text-slate-500">Một mã số thuế thuộc một cộng tác viên. Tối đa {CLAIM_LIMIT} mã. Không tạo tài khoản và không bật gói.</p>
      {partner.claims.length === 0 ? <p className="mt-3 text-sm text-slate-500">Chưa khóa mã số thuế.</p> : (
        <ul className="mt-3 divide-y divide-[#f3f0ff]">
          {partner.claims.map((claim) => (
            <li key={claim.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <span className="font-medium text-[#072348]">{claim.companyName}</span>
              <span className="text-xs text-slate-500">MST {claim.taxCode} · {claim.contactPhone}</span>
            </li>
          ))}
        </ul>
      )}
      {full ? <p className="mt-3 text-sm text-slate-500">Đã đủ {CLAIM_LIMIT} mã số thuế.</p> : (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input className={crmFieldClass} placeholder="Tên công ty" value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} required />
          <input className={crmFieldClass} placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} required />
          <input className={crmFieldClass} placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <button type="submit" className={crmButtonClass} disabled={add.isPending}>
            {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
          </button>
        </form>
      )}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </section>
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

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
