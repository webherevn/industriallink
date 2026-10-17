'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { CrmLeadSourceRow, CrmRenewalReportStatus, CrmStageMoneyRow } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { CrmMonthField } from '@/components/crm/fields';
import { formatVnd } from '@/components/crm/format';
import {
  fetchCrmLeadSourceReport,
  fetchCrmPartnerPaidReport,
  fetchCrmPipelineReport,
  fetchCrmQuoteReport,
  fetchCrmRenewalReport,
} from '@/lib/crm';

function currentVietnamMonth(): string {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function useReportMonth() {
  return useState(currentVietnamMonth());
}

function ReportBody({
  kicker,
  title,
  description,
  footnote,
  month,
  onMonth,
  loading,
  error,
  empty,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  footnote: string;
  month: string;
  onMonth: (value: string) => void;
  loading: boolean;
  error: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <CrmFrame kicker={kicker} title={title} description={description} footnote={footnote}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/crm/bao-cao" className="text-sm font-semibold text-[#4c3ec9]">Về báo cáo</Link>
        <div className="w-full max-w-xs">
          <CrmMonthField value={month} onChange={onMonth} max={currentVietnamMonth()} />
        </div>
      </div>
      {loading ? <CrmEmpty>Đang tải báo cáo…</CrmEmpty> : null}
      {error ? <CrmEmpty>Không tải được báo cáo.</CrmEmpty> : null}
      {empty ? <CrmEmpty>Chưa có số trong tháng này.</CrmEmpty> : null}
      {children}
    </CrmFrame>
  );
}

function MoneyTable({ title, rows, countLabel, moneyLabel }: { title: string; rows: CrmStageMoneyRow[]; countLabel: string; moneyLabel: string }) {
  return (
    <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Chưa có số.</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Giai đoạn</th>
                <th className="whitespace-nowrap px-4 py-3">{countLabel}</th>
                <th className="whitespace-nowrap px-4 py-3">{moneyLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.deals}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(row.listPriceVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function CrmPipelineReportPanel() {
  const [month, setMonth] = useReportMonth();
  const report = useQuery({ queryKey: ['crm-pipeline-report', month], queryFn: () => fetchCrmPipelineReport(month) });
  const data = report.data;
  const empty = data && data.stages.length === 0 && data.expected.length === 0;
  return (
    <ReportBody
      kicker="Giá niêm yết chưa VAT"
      title="Phễu cơ hội"
      description="Số cơ hội và giá niêm yết theo giai đoạn. Ngày kỳ vọng lọc theo tháng. Bước kết thúc thành công không phải doanh số."
      footnote="Doanh số chỉ tính ở báo cáo đơn đã trả."
      month={month}
      onMonth={setMonth}
      loading={report.isLoading}
      error={report.isError}
      empty={Boolean(empty)}
    >
      {data && !empty ? (
        <div className="space-y-4">
          <MoneyTable title="Đang có trên phễu" rows={data.stages} countLabel="Cơ hội" moneyLabel="Giá niêm yết" />
          <MoneyTable title="Ngày kỳ vọng trong tháng" rows={data.expected} countLabel="Cơ hội" moneyLabel="Giá niêm yết" />
        </div>
      ) : null}
    </ReportBody>
  );
}

function SourceTable({ title, rows }: { title: string; rows: CrmLeadSourceRow[] }) {
  return (
    <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Chưa có số.</p> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Nhóm</th>
                <th className="whitespace-nowrap px-4 py-3">Lead</th>
                <th className="whitespace-nowrap px-4 py-3">Công ty</th>
                <th className="whitespace-nowrap px-4 py-3">Đã trả gói</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.leads}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.companies}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{row.paidCompanies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function CrmLeadSourceReportPanel() {
  const [month, setMonth] = useReportMonth();
  const report = useQuery({ queryKey: ['crm-lead-source-report', month], queryFn: () => fetchCrmLeadSourceReport(month) });
  const data = report.data;
  const empty = data && data.bySource.length === 0 && data.byOwner.length === 0;
  return (
    <ReportBody
      kicker="Lead tạo trong tháng"
      title="Nguồn tiềm năng"
      description="Lead mới theo nguồn và người phụ trách. Cột đã trả gói là công ty có đơn gói sau khi lead được tạo."
      footnote="Lead chưa gắn công ty vẫn được đếm, nhưng chưa vào cột đã trả gói."
      month={month}
      onMonth={setMonth}
      loading={report.isLoading}
      error={report.isError}
      empty={Boolean(empty)}
    >
      {data && !empty ? (
        <div className="space-y-4">
          <SourceTable title="Theo nguồn" rows={data.bySource} />
          <SourceTable title="Theo người phụ trách" rows={data.byOwner} />
        </div>
      ) : null}
    </ReportBody>
  );
}

export function CrmQuoteReportPanel() {
  const [month, setMonth] = useReportMonth();
  const report = useQuery({ queryKey: ['crm-quote-report', month], queryFn: () => fetchCrmQuoteReport(month) });
  const data = report.data;
  const empty = data
    && data.rows.every((row) => row.quotes === 0)
    && data.enterprise.quotes === 0
    && data.enterprise.collectedVnd === '0';
  return (
    <ReportBody
      kicker="Giá niêm yết chưa VAT"
      title="Báo giá"
      description="Tờ lập trong tháng. Phương án 1 và phương án 2 để riêng. Enterprise tính riêng theo giá trị hợp đồng, không cộng vào hai phương án."
      footnote="Hai phương án không cộng thành một tổng. Công nợ Enterprise chỉ tính tờ đã chốt."
      month={month}
      onMonth={setMonth}
      loading={report.isLoading}
      error={report.isError}
      empty={Boolean(empty)}
    >
      {data && !empty ? (
        <section className="rounded-[22px] bg-white p-4 crm-surface">
          <h2 className="text-sm font-semibold text-slate-900">Enterprise</h2>
          <p className="mt-1 text-xs text-slate-400">Tờ lập trong tháng. Giá trị đã chốt không gồm bản thảo. Còn phải thu là phần chưa thu của các tờ này. Đã thu là mọi đợt ghi trong tháng.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <p className="text-sm text-slate-600">Tờ <span className="font-semibold text-slate-900">{data.enterprise.quotes}</span></p>
            <p className="text-sm text-slate-600">Giá trị đã chốt <span className="font-semibold text-slate-900">{formatVnd(data.enterprise.contractVnd)}</span></p>
            <p className="text-sm text-slate-600">Đã chốt <span className="font-semibold text-slate-900">{data.enterprise.accepted}</span></p>
            <p className="text-sm text-slate-600">Còn của tờ trong tháng <span className="font-semibold text-[#9a3412]">{formatVnd(data.enterprise.receivableVnd)}</span></p>
          </div>
          <p className="mt-3 text-sm text-slate-600">Đã ghi thu trong tháng <span className="font-semibold text-[#0f766e]">{formatVnd(data.enterprise.collectedVnd)}</span></p>
        </section>
      ) : null}
      {data && data.rows.some((row) => row.quotes > 0) ? (
        <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Tình trạng</th>
                  <th className="whitespace-nowrap px-4 py-3">Số tờ</th>
                  <th className="whitespace-nowrap px-4 py-3">Phương án 1</th>
                  <th className="whitespace-nowrap px-4 py-3">Phương án 2</th>
                  <th className="whitespace-nowrap px-4 py-3">Đã có đơn</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.status} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.label}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.quotes}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatVnd(row.option1Vnd)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.option2Quotes > 0 ? `${row.option2Quotes} tờ · ${formatVnd(row.option2Vnd)}` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{row.paidQuotes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ReportBody>
  );
}

const RENEWAL_LABEL: Record<CrmRenewalReportStatus, string> = {
  ending: 'Sắp hết',
  expired: 'Đã hết',
  renewed: 'Đã gia hạn',
};

export function CrmRenewalReportPanel() {
  const [month, setMonth] = useReportMonth();
  const report = useQuery({ queryKey: ['crm-renewal-report', month], queryFn: () => fetchCrmRenewalReport(month) });
  const data = report.data;
  const empty = data && data.rows.length === 0;
  return (
    <ReportBody
      kicker="Hạn gói trên inlink"
      title="Gia hạn"
      description="Gói có ngày hết hạn trong tháng. Đã gia hạn là đã có đơn gói trả trước đó và có đơn trả mới trong tháng."
      footnote="Báo cáo này không bật gói và không cộng Credit."
      month={month}
      onMonth={setMonth}
      loading={report.isLoading}
      error={report.isError}
      empty={Boolean(empty)}
    >
      {data && !empty ? (
        <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
          <div className="border-b border-slate-100 px-4 py-4 text-sm text-slate-600">
            Sắp hết {data.ending} · Đã hết {data.expired} · Đã gia hạn {data.renewed}
          </div>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Công ty</th>
                  <th className="whitespace-nowrap px-4 py-3">Loại</th>
                  <th className="whitespace-nowrap px-4 py-3">Gói</th>
                  <th className="whitespace-nowrap px-4 py-3">Hết hạn</th>
                  <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3">Đã trả trong tháng</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.companyId}-${row.kind}`} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.companyName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.planName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.endsAt ? new Date(row.endsAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{RENEWAL_LABEL[row.status]}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(row.paidAmountVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ReportBody>
  );
}

export function CrmPartnerPaidReportPanel() {
  const [month, setMonth] = useReportMonth();
  const report = useQuery({ queryKey: ['crm-partner-paid-report', month], queryFn: () => fetchCrmPartnerPaidReport(month) });
  const data = report.data;
  const empty = data && data.rows.length === 0;
  return (
    <ReportBody
      kicker="Đơn đã trả gắn mã giới thiệu"
      title="Cộng tác viên"
      description="Khách đã trả gói tin hoặc gói Săn trong tháng, gắn mã giới thiệu. Tiền là số khách trả, chưa VAT."
      footnote="Hoa hồng xem ở mục tài chính. Báo cáo này không cộng hoa hồng vào chi phí."
      month={month}
      onMonth={setMonth}
      loading={report.isLoading}
      error={report.isError}
      empty={Boolean(empty)}
    >
      {data && !empty ? (
        <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Cộng tác viên</th>
                  <th className="whitespace-nowrap px-4 py-3">Đơn</th>
                  <th className="whitespace-nowrap px-4 py-3">Công ty</th>
                  <th className="whitespace-nowrap px-4 py-3">Gói tin</th>
                  <th className="whitespace-nowrap px-4 py-3">Gói Săn</th>
                  <th className="whitespace-nowrap px-4 py-3">Khách đã trả</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.partnerId} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.label}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.orders}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.companies}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatVnd(row.platformPaidVnd)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatVnd(row.sourcingPaidVnd)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#4c3ec9]">{formatVnd(row.paidAmountVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </ReportBody>
  );
}
