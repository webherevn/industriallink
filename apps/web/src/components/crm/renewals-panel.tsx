'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CalendarClock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmActionClass, crmButtonClass } from '@/components/crm-frame';
import { errorText, formatWhen, matchesQuery, renewalLabel } from '@/components/crm/format';
import { useCrmRenewals } from '@/components/crm/use-crm-board';
import { createCrmDeal, fetchCrmCustomerHealth } from '@/lib/crm';

export function CrmRenewalsPanel() {
  const renewals = useCrmRenewals();
  const health = useQuery({ queryKey: ['crm-customer-health'], queryFn: fetchCrmCustomerHealth });
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'AT_RISK' | 'WATCH' | 'HEALTHY'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const addDeal = useMutation({
    mutationFn: (input: { leadId: string; title: string; planKind: 'platform' | 'sourcing'; planCode: string }) =>
      createCrmDeal(input),
    onSuccess: () => {
      setError(null);
      setPendingId(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-renewals'] });
    },
    onError: (err) => {
      setPendingId(null);
      setError(errorText(err, 'Không tạo được deal gia hạn'));
    },
  });

  const rows = (renewals.data ?? []).filter((row) =>
    matchesQuery(query, [row.companyName, row.planName, row.planCode]),
  );
  const healthItems = (health.data?.items ?? []).filter((item) => {
    if (healthFilter !== 'ALL' && item.level !== healthFilter) return false;
    return matchesQuery(query, [item.companyName, item.ownerName ?? '', ...item.activePlans, ...item.reasons]);
  });

  return (
    <CrmFrame
      kicker="Khách đang dùng inlink"
      title="Gia hạn & Sức khỏe khách hàng (Churn Alert)"
      description="Theo dõi điểm sức khỏe khách trả phí để chăm sóc sớm trước khi rời bỏ, và tạo deal gia hạn cho gói sắp hết hạn."
      placeholder="Tìm nhà máy, tên gói hoặc người phụ trách"
      search={{ value: query, onChange: setQuery }}
      footnote="Hết hạn trong 30 ngày, hoặc quá hạn chưa tới 14 ngày. CRM không gán gói."
    >
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}

      {health.data && health.data.totalPaidCustomers > 0 ? (
        <section className="rounded-[22px] border border-[#DCE6F4] bg-white p-5 crm-surface">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FB] text-[#072348]">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#072348]">
                  Sức khỏe khách hàng trả phí ({health.data.totalPaidCustomers} DN)
                </h2>
                <p className="text-xs text-slate-500">
                  Tự động chấm điểm 0–100 dựa trên mức độ đăng tin, kích hoạt gói Săn, số ứng viên và hạn gói.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['ALL', `Tất cả (${health.data.totalPaidCustomers})`],
                  ['AT_RISK', `Nguy cơ cao (${health.data.atRiskCount})`],
                  ['WATCH', `Cần theo dõi (${health.data.watchCount})`],
                  ['HEALTHY', `Ổn định (${health.data.healthyCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHealthFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    healthFilter === key
                      ? key === 'AT_RISK'
                        ? 'bg-rose-600 text-white'
                        : key === 'WATCH'
                          ? 'bg-[#E8872A] text-white'
                          : 'bg-[#072348] text-white'
                      : 'bg-[#F5F8FC] text-[#072348] hover:bg-[#E8F0FA]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {healthItems.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#F5F8FC] px-4 py-5 text-center text-xs text-slate-500">
              Không có khách hàng nào trong nhóm lọc này.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#DCE6F4] bg-[#F5F8FC] text-xs font-semibold text-[#072348]">
                    <th className="rounded-l-xl px-3 py-2.5">Doanh nghiệp & Gói</th>
                    <th className="px-3 py-2.5 text-center">Điểm sức khỏe</th>
                    <th className="px-3 py-2.5 text-center">Tin / Ứng viên</th>
                    <th className="px-3 py-2.5">Cảnh báo chăm sóc</th>
                    <th className="rounded-r-xl px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {healthItems.map((item) => (
                    <tr key={item.companyId} className="hover:bg-[#F5F8FC]/60">
                      <td className="px-3 py-3">
                        <Link
                          href={`/crm/companies/${item.companyId}`}
                          className="font-semibold text-[#072348] hover:text-[#0B468C] hover:underline"
                        >
                          {item.companyName}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.activePlans.join(' · ')}
                          {item.ownerName ? ` · Sale: ${item.ownerName}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            item.level === 'AT_RISK'
                              ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200'
                              : item.level === 'WATCH'
                                ? 'bg-[#FFF4E8] text-[#B85D0B] ring-1 ring-inset ring-[#F5C591]'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          }`}
                        >
                          {item.level === 'AT_RISK' ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
                          {item.score}/100
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-slate-700">
                        {item.publishedJobCount} tin · {item.applicantCount} UV
                      </td>
                      <td className="px-3 py-3">
                        {item.reasons.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {item.reasons.map((r, idx) => (
                              <span key={idx} className="text-xs text-slate-700">
                                • {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">
                            Đang sử dụng gói hiệu quả
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/crm/companies/${item.companyId}`}
                          className="inline-flex items-center rounded-lg bg-[#072348] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0B468C]"
                        >
                          Chăm sóc
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
      {renewals.isLoading ? <CrmEmpty>Đang tải khách sắp hết hạn…</CrmEmpty> : null}
      {renewals.isError ? <CrmEmpty>Không tải được danh sách gia hạn.</CrmEmpty> : null}
      {renewals.data && renewals.data.length === 0 ? (
        <CrmEmpty>Không có khách hết hạn trong cửa sổ này.</CrmEmpty>
      ) : null}
      {renewals.data && renewals.data.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có khách khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <CrmCardGrid columns={3}>
          {rows.map((row) => {
            const key = `${row.kind}-${row.companyId}`;
            return (
              <CrmCard
                key={key}
                tone={row.daysLeft < 7 ? 'rose' : 'orange'}
                icon={<CalendarClock className="h-5 w-5" />}
                title={`${row.companyName} · ${row.planName}`}
                  text={`${row.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'} · ${renewalLabel(row.daysLeft)}. Credit còn ${row.creditBalance}. Tin đang đăng ${row.openJobCount}. ${row.cyclePaidAt ? `Đã thanh toán kỳ này ${formatWhen(row.cyclePaidAt)}.` : 'Kỳ này chưa thấy đơn gói đã thanh toán.'} ${row.leadId ? 'Có lead để mở deal gia hạn.' : 'Chưa có lead khớp công ty này.'}`}
                  meta={row.planCode}
              >
                {row.openJobCount === 0 ? (
                  <p className="mt-3 text-xs font-semibold text-rose-600">Chưa đăng tin</p>
                ) : null}
                <div className="mt-auto grid gap-2 pt-4">
                  <Link href={`/crm/companies/${row.companyId}`} className={`${crmActionClass} w-full`}>
                    Hồ sơ công ty
                  </Link>
                  {row.leadId ? (
                    <button
                      type="button"
                      className={`${crmButtonClass} w-full`}
                      disabled={addDeal.isPending}
                      onClick={() => {
                        setPendingId(key);
                        addDeal.mutate({
                          leadId: row.leadId!,
                          title: `Gia hạn ${row.planName} — ${row.companyName}`,
                          planKind: row.kind,
                          planCode: row.planCode,
                        });
                      }}
                    >
                      {pendingId === key && addDeal.isPending ? 'Đang tạo…' : 'Tạo deal gia hạn'}
                    </button>
                  ) : null}
                </div>
              </CrmCard>
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
