'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CrmCommissionPeriodView, CrmKycStatus } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { downloadCsv, errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmCommissionPeriods, fetchCrmPayoutDay, markCrmCommissionPaid } from '@/lib/crm';

const KYC_META: Record<CrmKycStatus, { label: string; chip: string }> = {
  UNVERIFIED: { label: 'Chưa xác thực', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PENDING: { label: 'Chờ duyệt', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  VERIFIED: { label: 'Đã xác thực', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Từ chối', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

/** Ngưỡng khấu trừ thuế TNCN 10% cho CTV cá nhân. */
const PIT_THRESHOLD_VND = 2_000_000n;

export function CrmAccountingPanel() {
  const periods = useQuery({ queryKey: ['crm-commission-periods'], queryFn: fetchCrmCommissionPeriods });
  const payout = useQuery({ queryKey: ['crm-payout-day'], queryFn: fetchCrmPayoutDay });
  const [query, setQuery] = useState('');
  const all = periods.data?.periods ?? [];
  const payable = all.filter((period) => period.status === 'payable');
  const paid = all.filter((period) => period.status === 'paid');
  const waiting = payable.filter((period) => matches(query, period));
  const settled = paid.filter((period) => matches(query, period));
  const rows = [...waiting, ...settled];

  return (
    <CrmFrame
      kicker="Kỳ đã được phép chi"
      title="Kế toán"
      description="Bảng kê để chuyển khoản bằng tay. Ghi đã chi thì trừ đúng số hoa hồng của kỳ khỏi ví trên inlink. Không gửi lệnh sang ngân hàng."
      placeholder="Tìm cộng tác viên hoặc tháng"
      search={{ value: query, onChange: setQuery }}
      footnote="Bảng kê không phải lệnh chuyển khoản. Đã chi chỉ ghi trên sổ và trừ ví."
    >
      {payout.data ? (
        <p className="text-center text-sm text-slate-500">
          Ngày chi đang đặt: ngày {payout.data.day} hàng tháng. Đến ngày đó kế toán ghi đã chi. Ví không tự trừ.
        </p>
      ) : null}
      {periods.isLoading ? <CrmEmpty>Đang tải kỳ chờ chi…</CrmEmpty> : null}
      {periods.isError ? <CrmEmpty>Không tải được danh sách kế toán.</CrmEmpty> : null}
      {periods.data && payable.length === 0 && paid.length === 0 ? (
        <CrmEmpty>Chưa có kỳ nào được phép chi. Cho phép chi từ mục Kỳ chốt.</CrmEmpty>
      ) : null}
      {periods.data && (payable.length > 0 || paid.length > 0) && waiting.length === 0 && settled.length === 0 ? (
        <CrmEmpty>Không có kỳ khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <Register rows={rows} exportRows={[...payable, ...paid]} canPay={Boolean(periods.data?.canClose)} />
      ) : null}
    </CrmFrame>
  );
}

function Register({
  rows,
  exportRows,
  canPay,
}: {
  rows: CrmCommissionPeriodView[];
  exportRows: CrmCommissionPeriodView[];
  canPay: boolean;
}) {
  const waitingTotal = rows
    .filter((period) => period.status === 'payable')
    .reduce((sum, period) => sum + BigInt(period.commissionVnd || '0'), 0n);
  const blocked = rows.filter(
    (period) => period.status === 'payable' && period.kycStatus !== 'VERIFIED',
  ).length;
  return (
    <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bảng kê</h2>
          <p className="mt-1 text-sm text-slate-500">
            Chờ chi {formatVnd(waitingTotal.toString())}. Dùng bảng này để chuyển khoản bên ngoài. Nút Đã chi chỉ trừ ví trên inlink.
          </p>
          {blocked > 0 ? (
            <p className="mt-1.5 text-xs font-medium text-amber-700">
              {blocked} kỳ bị khóa vì CTV chưa xác thực CCCD & tài khoản ngân hàng — số dư được bảo lưu sang kỳ chi trả tiếp theo.
            </p>
          ) : null}
        </div>
        <button type="button" className={crmButtonClass} onClick={() => downloadRegister(exportRows)}>
          Tải bảng kê
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Cộng tác viên</th>
              <th className="px-4 py-3">Tháng</th>
              <th className="px-4 py-3">Hoa hồng</th>
              <th className="px-4 py-3">Thuế TNCN</th>
              <th className="px-4 py-3">Thực nhận</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Mã giao dịch</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((period) => (
              <RegisterRow key={period.id} period={period} canPay={canPay} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RegisterRow({ period, canPay }: { period: CrmCommissionPeriodView; canPay: boolean }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [transferRef, setTransferRef] = useState('');
  const [showRefInput, setShowRefInput] = useState(false);
  const pay = useMutation({
    mutationFn: () => markCrmCommissionPaid(period.id, { transferRef: transferRef.trim() || null }),
    onSuccess: async () => {
      setError(null);
      setShowRefInput(false);
      await qc.invalidateQueries({ queryKey: ['crm-commission-periods'] });
      await qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không ghi được đã chi')),
  });

  const paid = period.status === 'paid';
  const kycVerified = period.kycStatus === 'VERIFIED';
  const gross = BigInt(period.commissionVnd || '0');
  const suggestedTax = gross >= PIT_THRESHOLD_VND ? (gross * 10n) / 100n : 0n;
  const suggestedNet = gross - suggestedTax;

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{period.partnerName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{period.partnerCode}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{formatPeriodLabel(period.periodMonth)}</td>
      <td className="px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(period.commissionVnd)}</td>
      <td className="px-4 py-3">
        {paid && period.pitTaxAmountVnd != null ? (
          <span className="text-slate-700">{formatVnd(period.pitTaxAmountVnd)}</span>
        ) : suggestedTax > 0n ? (
          <span className="inline-flex flex-col">
            <span className="font-medium text-amber-700">{formatVnd(suggestedTax.toString())}</span>
            <span className="mt-0.5 text-[11px] text-amber-600">Gợi ý khấu trừ 10%</span>
          </span>
        ) : (
          <span className="text-slate-400">0đ</span>
        )}
      </td>
      <td className="px-4 py-3">
        {paid && period.netPaidAmountVnd != null ? (
          <span className="font-medium text-slate-800">{formatVnd(period.netPaidAmountVnd)}</span>
        ) : (
          <span className="text-slate-500">{formatVnd(suggestedNet.toString())}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${KYC_META[period.kycStatus].chip}`}
          title={
            kycVerified
              ? 'Đã duyệt CCCD & tài khoản ngân hàng'
              : 'Cần duyệt CCCD & tài khoản ngân hàng trước khi chi trả'
          }
        >
          {KYC_META[period.kycStatus].label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paid ? 'bg-[#efeaff] text-[#4c3ec9]' : 'bg-emerald-50 text-emerald-800'}`}>
          {paid ? 'Đã chi' : 'Chờ chi'}
        </span>
        <p className="mt-1 text-[11px] text-slate-400">
          {paid
            ? `Đã chi ${period.paidAt ? formatWhen(period.paidAt) : '—'}`
            : `Cho phép chi ${period.approvedAt ? formatWhen(period.approvedAt) : '—'}`}
        </p>
      </td>
      <td className="px-4 py-3">
        {paid && period.transferRef ? (
          <span className="font-mono text-xs text-slate-700">{period.transferRef}</span>
        ) : canPay && !paid && showRefInput ? (
          <input
            autoFocus
            className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#c4b5fd]"
            placeholder="Mã giao dịch / UNC"
            value={transferRef}
            onChange={(event) => setTransferRef(event.target.value)}
          />
        ) : canPay && !paid ? (
          <button
            type="button"
            className="text-xs font-medium text-[#4c3ec9] underline"
            onClick={() => setShowRefInput(true)}
          >
            Nhập mã giao dịch
          </button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {canPay && !paid ? (
          kycVerified ? (
            <button type="button" className={crmButtonClass} disabled={pay.isPending} onClick={() => pay.mutate()}>
              {pay.isPending ? 'Đang ghi…' : 'Đã chi'}
            </button>
          ) : (
            <span title="Cần duyệt CCCD & tài khoản ngân hàng trước khi chi trả">
              <button type="button" className={`${crmButtonClass} cursor-not-allowed opacity-40`} disabled>
                Đã chi
              </button>
            </span>
          )
        ) : null}
        {!kycVerified && !paid ? (
          <p className="mt-1.5 max-w-44 text-[11px] leading-snug text-amber-700">
            Cần duyệt CCCD & tài khoản ngân hàng trước khi chi trả
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </td>
    </tr>
  );
}

function downloadRegister(rows: CrmCommissionPeriodView[]) {
  downloadCsv('bang-ke-hoa-hong.csv', [
    ['Cộng tác viên', 'Mã', 'Tháng', 'Hoa hồng', 'Thuế TNCN', 'Thực nhận', 'KYC', 'Trạng thái', 'Mã giao dịch', 'Thời điểm'],
    ...rows.map((period) => {
      const gross = BigInt(period.commissionVnd || '0');
      const suggestedTax = gross >= PIT_THRESHOLD_VND ? (gross * 10n) / 100n : 0n;
      const suggestedNet = gross - suggestedTax;
      return [
        period.partnerName,
        period.partnerCode,
        period.periodMonth,
        period.commissionVnd,
        period.pitTaxAmountVnd ?? suggestedTax.toString(),
        period.netPaidAmountVnd ?? suggestedNet.toString(),
        KYC_META[period.kycStatus].label,
        period.status === 'paid' ? 'Đã chi' : 'Chờ chi',
        period.transferRef ?? '',
        period.status === 'paid' ? (period.paidAt ?? '') : (period.approvedAt ?? ''),
      ];
    }),
  ]);
}

function matches(query: string, period: CrmCommissionPeriodView): boolean {
  return matchesQuery(query, [period.partnerName, period.partnerCode, period.periodMonth, formatPeriodLabel(period.periodMonth)]);
}

function formatPeriodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  if (!year || !month) return periodMonth;
  return `tháng ${Number(month)}/${year}`;
}
