'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { contactPhoneLabel, errorText, followUpLabel, formatVnd, formatWhen, leadStatusLabel } from '@/components/crm/format';
import { claimCrmCustomer, fetchCrmCompany } from '@/lib/crm';

export function CrmCompanyPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ['crm-company', companyId], queryFn: () => fetchCrmCompany(companyId) });
  const [error, setError] = useState<string | null>(null);
  const claim = useMutation({
    mutationFn: () => claimCrmCustomer(companyId),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-company', companyId] });
      void qc.invalidateQueries({ queryKey: ['crm-unclaimed'] });
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-renewals'] });
    },
    onError: (err) => setError(errorText(err, 'Không nhận được khách')),
  });
  const data = profile.data;

  return (
    <CrmFrame
      kicker="Một nhà tuyển dụng"
      title={data?.name ?? 'Hồ sơ công ty'}
      description="Gói đang chạy, credit, đơn đã trả và người phụ trách. Trang này không bật gói và không thu thêm."
      footnote="Giá trên đơn là số đã thanh toán, chưa cộng thuế."
    >
      {profile.isLoading ? <CrmEmpty>Đang tải hồ sơ…</CrmEmpty> : null}
      {profile.isError ? <CrmEmpty>Không tải được hồ sơ công ty.</CrmEmpty> : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[22px] bg-white p-5 crm-surface">
            <h2 className="text-sm font-semibold text-slate-900">Đang dùng</h2>
            <p className="mt-2 text-sm text-slate-600">{data.taxCode ? `MST ${data.taxCode}` : 'Chưa có mã số thuế'}{data.industry ? ` · ${data.industry}` : ''}</p>
            <ContactLines lead={data.leads[0] ?? null} companyAddress={data.address} companyIndustry={data.industry} />
            <PlanLine label="Gói tin" plan={data.platformPlan} />
            <PlanLine label="Gói Săn" plan={data.sourcingPlan} />
            <p className="mt-3 text-sm text-slate-700">Credit còn {data.creditBalance}. Tin đang đăng {data.openJobCount}.</p>
            <p className="mt-1 text-sm text-slate-700">
              {data.partnerName ? `Cộng tác viên ${data.partnerName} (${data.partnerCode})` : 'Không gắn cộng tác viên'}
            </p>
            {data.leads.length === 0 ? (
              <button
                type="button"
                className="mt-4 rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={claim.isPending}
                onClick={() => claim.mutate()}
              >
                {claim.isPending ? 'Đang nhận…' : 'Nhận khách'}
              </button>
            ) : null}
          </section>
          <section className="rounded-[22px] bg-white p-5 crm-surface">
            <h2 className="text-sm font-semibold text-slate-900">Người phụ trách</h2>
            {data.leads.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có lead.</p> : null}
            <ul className="mt-2 space-y-2">
              {data.leads.map((lead) => (
                <li key={lead.id} className="text-sm text-slate-700">
                  <Link href="/crm/leads" className="font-medium text-[#4c3ec9]">{lead.leadCode}</Link>
                  {` · ${lead.ownerName} · ${leadStatusLabel(lead.status)} · ${contactPhoneLabel(lead.contactPhone)}`}
                  {lead.nextFollowUpAt ? ` · ${followUpLabel(lead.nextFollowUpAt)}` : ''}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[22px] bg-white p-5 crm-surface lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Đơn đã thanh toán</h2>
            {data.orders.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có đơn gói đã trả.</p> : null}
            <ul className="mt-2 divide-y divide-slate-100">
              {data.orders.map((order) => (
                <li key={order.billingOrderId} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm text-slate-700">
                  <span>{order.planName ?? order.planCode ?? (order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin')} · chưa VAT {formatVnd(order.paidAmountVnd)} · khách trả {formatVnd(order.payableVnd)} · {formatWhen(order.paidAt)}</span>
                  <Link href={`/crm/finance?q=${encodeURIComponent(order.invoiceNumber ?? data.name)}`} className="text-[#4c3ec9]">
                    {order.invoiceNumber ? `Hóa đơn ${order.invoiceNumber}` : 'Chưa ghi số hóa đơn'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </CrmFrame>
  );
}

function ContactLines({
  lead,
  companyAddress,
  companyIndustry,
}: {
  lead: {
    contactName: string;
    department: string | null;
    contactPhone: string;
    contactEmail: string | null;
    orgField: string | null;
    industry: string | null;
    address: string | null;
  } | null;
  companyAddress: string | null;
  companyIndustry: string | null;
}) {
  const field = lead?.orgField || lead?.industry || companyIndustry;
  const address = lead?.address || companyAddress;
  return (
    <div className="mt-3 space-y-1 text-sm text-slate-700">
      <p>Người liên hệ: {lead?.contactName || 'Chưa có'}</p>
      <p>Bộ phận: {lead?.department || 'Chưa có'}</p>
      <p>Điện thoại: {lead ? contactPhoneLabel(lead.contactPhone) : 'Chưa có'}</p>
      <p>Email: {lead?.contactEmail || 'Chưa có'}</p>
      <p>Lĩnh vực: {field || 'Chưa có'}</p>
      <p>Địa chỉ: {address || 'Chưa có'}</p>
    </div>
  );
}

function PlanLine({
  label,
  plan,
}: {
  label: string;
  plan: { name: string; endsAt: string | null; active: boolean } | null;
}) {
  if (!plan) return <p className="mt-2 text-sm text-slate-500">{label}: chưa có.</p>;
  const when = plan.endsAt ? formatWhen(plan.endsAt) : 'không ghi ngày hết';
  return (
    <p className="mt-2 text-sm text-slate-700">
      {label}: {plan.name}. {plan.active ? `Còn đến ${when}` : `Không còn hiệu lực (${when})`}.
    </p>
  );
}
