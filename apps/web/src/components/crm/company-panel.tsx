'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmCompanyActivityEvent, CrmCompanyPlatformActivityView } from '@industriallink/contracts';
import { Activity, AlertTriangle, Briefcase, Coins, Crosshair, Flame, Info, ShoppingBag, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { contactPhoneLabel, errorText, followUpLabel, formatVnd, formatWhen, leadStatusLabel } from '@/components/crm/format';
import { CrmCompanyAiCopilot } from '@/components/crm/company-ai-copilot';
import { CrmCompanySourcingOutreachSection } from '@/components/crm/sourcing-outreach-panel';
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
                  <Link href="/crm/leads" className="font-medium text-[#0B468C] hover:underline">{lead.leadCode}</Link>
                  {` · ${lead.ownerName} · ${leadStatusLabel(lead.status)} · ${contactPhoneLabel(lead.contactPhone)}`}
                  {lead.nextFollowUpAt ? ` · ${followUpLabel(lead.nextFollowUpAt)}` : ''}
                </li>
              ))}
            </ul>
          </section>
          <CrmCompanyAiCopilot companyId={companyId} />
          {data.platformActivity ? (
            <PlatformActivitySection activity={data.platformActivity} />
          ) : null}
          <CrmCompanySourcingOutreachSection
            items={data.sourcingOutreaches ?? []}
            companyId={companyId}
          />
          <section className="rounded-[22px] bg-white p-5 crm-surface lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-900">Đơn đã thanh toán</h2>
            {data.orders.length === 0 ? <p className="mt-2 text-sm text-slate-500">Chưa có đơn gói đã trả.</p> : null}
            <ul className="mt-2 divide-y divide-slate-100">
              {data.orders.map((order) => (
                <li key={order.billingOrderId} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm text-slate-700">
                  <span>{order.planName ?? order.planCode ?? (order.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin')} · chưa VAT {formatVnd(order.paidAmountVnd)} · khách trả {formatVnd(order.payableVnd)} · {formatWhen(order.paidAt)}</span>
                  <Link href={`/crm/finance?q=${encodeURIComponent(order.invoiceNumber ?? data.name)}`} className="text-[#0B468C] hover:underline">
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

const ACTIVITY_CATEGORY_FILTERS: Array<{
  id: 'all' | CrmCompanyActivityEvent['category'];
  label: string;
}> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'intent', label: 'Hành vi NTD' },
  { id: 'job', label: 'Tin đăng' },
  { id: 'order', label: 'Đơn hàng' },
  { id: 'credit', label: 'Credit' },
  { id: 'sourcing', label: 'Tin săn' },
  { id: 'application', label: 'Ứng viên' },
];

function activityCategoryBadge(category: CrmCompanyActivityEvent['category']): {
  label: string;
  className: string;
} {
  switch (category) {
    case 'intent':
      return { label: 'Hành vi NTD', className: 'bg-rose-50 text-rose-700 ring-rose-200/70' };
    case 'job':
      return { label: 'Tin đăng', className: 'bg-sky-50 text-sky-700 ring-sky-200/70' };
    case 'order':
      return { label: 'Đơn hàng', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' };
    case 'credit':
      return { label: 'Credit', className: 'bg-amber-50 text-amber-800 ring-amber-200/70' };
    case 'sourcing':
      return { label: 'Tin săn', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70' };
    case 'application':
      return { label: 'Ứng viên', className: 'bg-slate-100 text-slate-700 ring-slate-200/80' };
  }
}

function PlatformActivitySection({ activity }: { activity: CrmCompanyPlatformActivityView }) {
  const [catFilter, setCatFilter] = useState<'all' | CrmCompanyActivityEvent['category']>('all');
  const visibleEvents =
    catFilter === 'all'
      ? activity.timeline
      : activity.timeline.filter((ev) => ev.category === catFilter);

  return (
    <section className="rounded-[22px] bg-white p-5 crm-surface lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#072348]" />
          <h2 className="text-sm font-semibold text-slate-900">Hoạt động trên nền tảng inLink</h2>
        </div>
        <span className="text-xs text-slate-500">
          {activity.lastActivityAt
            ? `Hoạt động gần nhất: ${formatWhen(activity.lastActivityAt)}`
            : 'Chưa ghi nhận hoạt động'}
        </span>
      </div>

      {/* Dải tín hiệu nóng CSKH */}
      {activity.signals.length > 0 ? (
        <div className="mt-3.5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Tín hiệu cần chú ý cho CSKH
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {activity.signals.map((sig) => {
              const tone =
                sig.severity === 'hot'
                  ? 'border-rose-200 bg-rose-50/80 text-rose-900'
                  : sig.severity === 'warn'
                    ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                    : 'border-sky-200 bg-sky-50/70 text-sky-900';
              const Icon =
                sig.severity === 'hot' ? Flame : sig.severity === 'warn' ? AlertTriangle : Info;
              return (
                <div
                  key={sig.code}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${tone}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-snug">{sig.label}</p>
                    <p className="mt-0.5 text-[11.5px] opacity-85">{sig.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
          Chưa có cảnh báo nóng — tài khoản đang hoạt động bình thường.
        </p>
      )}

      {/* 4 chỉ số tổng quan nhanh */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Tin tuyển dụng</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#072348]">
            {activity.jobs.published} đang mở
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activity.jobs.draft} nháp · {activity.jobs.rejected} từ chối · {activity.jobs.pausedOrClosed} dừng/đóng
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Users className="h-3.5 w-3.5" />
            <span>Ứng viên nộp đơn</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#072348]">
            {activity.applicants.total} hồ sơ
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activity.applicants.unreviewed} chưa xử lý
            {activity.applicants.staleUnreviewed > 0
              ? ` (${activity.applicants.staleUnreviewed} quá 48h)`
              : ''}
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Crosshair className="h-3.5 w-3.5" />
            <span>Săn nhân sự</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#072348]">
            {activity.sourcing.activeCampaigns} chiến dịch chạy
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activity.sourcing.profilesOpened} hồ sơ đã mở qua săn tin
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Đơn chờ thanh toán</span>
          </div>
          <p className="mt-1 text-base font-bold text-[#072348]">
            {activity.pendingOrdersCount} đơn (7 ngày)
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activity.pendingOrdersCount > 0 ? 'Cần liên hệ hỗ trợ chốt thanh toán' : 'Không có đơn treo'}
          </p>
        </div>
      </div>

      {/* Dòng thời gian hoạt động gần nhất */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dòng hoạt động gần nhất ({visibleEvents.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_CATEGORY_FILTERS.map((f) => {
              const active = catFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCatFilter(f.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-[#072348] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có hoạt động nào trong nhóm này.</p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto pr-1">
            {visibleEvents.map((ev) => {
              const badge = activityCategoryBadge(ev.category);
              return (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{ev.title}</p>
                      {ev.detail ? (
                        <p className="truncate text-xs text-slate-500">{ev.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatWhen(ev.occurredAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
