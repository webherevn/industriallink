'use client';

import {
  Building2,
  CalendarClock,
  Kanban,
  NotebookPen,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmChip, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatVnd, formatWhen, isFresh, matchesQuery, renewalLabel } from '@/components/crm/format';
import { useCrmBoard, useCrmRenewals } from '@/components/crm/use-crm-board';

export function CrmHomePanel() {
  const board = useCrmBoard();
  const renewals = useCrmRenewals();
  const [query, setQuery] = useState('');
  const leads = board.data?.leads ?? [];
  const deals = board.data?.deals ?? [];
  const openLeads = leads.filter((lead) => lead.status === 'open').length;
  const running = deals.filter((deal) => deal.stageCode !== 'won' && deal.stageCode !== 'lost').length;
  const waiting = deals.filter((deal) => deal.stageCode === 'awaiting_payment').length;
  const due = renewals.data?.length ?? 0;
  const needle = query.trim();
  const matchedLeads = leads.filter((lead) =>
    matchesQuery(query, [lead.companyName, lead.contactName, lead.contactPhone, lead.taxCode, lead.leadCode]),
  );
  const matchedDeals = deals.filter((deal) =>
    matchesQuery(query, [deal.companyName, deal.title, deal.planCode, deal.dealCode]),
  );

  return (
    <CrmFrame
      kicker="Lead, deal đang chờ tiền và khách sắp hết gói"
      title="Bàn làm việc của đội kinh doanh"
      description="Số lấy từ lead và deal đang ghi trong CRM. Chốt deal không tự bật gói nhà tuyển dụng."
      placeholder="Tìm lead, deal hoặc nhà máy"
      search={{ value: query, onChange: setQuery }}
      footnote="CRM không gán gói và không cộng Credit."
      chips={
        <>
          <CrmChip href="/crm/leads" icon={<Building2 className="h-4 w-4" />} label="Lead" />
          <CrmChip href="/crm/pipeline" icon={<Kanban className="h-4 w-4" />} label="Phễu bán gói" />
          <CrmChip href="/crm/activities" icon={<NotebookPen className="h-4 w-4" />} label="Nhật ký" />
          <CrmChip href="/crm/finance" icon={<Receipt className="h-4 w-4" />} label="Công nợ & VAT" />
          <CrmChip href="/crm/renewals" icon={<CalendarClock className="h-4 w-4" />} label="Gia hạn" />
          <CrmChip href="/crm/partners" icon={<Users className="h-4 w-4" />} label="Cộng tác viên" />
        </>
      }
    >
      {board.isLoading ? <CrmEmpty>Đang tải bàn làm việc…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được dữ liệu CRM.</CrmEmpty> : null}
      {board.data && !needle ? (
        <CrmCardGrid>
          <Link href="/crm/leads" className="block h-full">
            <CrmCard tone="sky" icon={<Building2 className="h-5 w-5" />} title={`${openLeads} lead đang mở`} text="Nhà máy chưa chuyển thành deal." />
          </Link>
          <Link href="/crm/pipeline" className="block h-full">
            <CrmCard tone="violet" icon={<Kanban className="h-5 w-5" />} title={`${running} deal đang chạy`} text="Gói tin và gói Săn còn trong phễu." />
          </Link>
          <Link href="/crm/pipeline" className="block h-full">
            <CrmCard tone="orange" icon={<Wallet className="h-5 w-5" />} title={`${waiting} chờ thanh toán`} text="Đã tới bước chờ tiền. Chưa có đơn thanh toán từ CRM." />
          </Link>
          <Link href="/crm/renewals" className="block h-full">
            <CrmCard
              tone="green"
              icon={<CalendarClock className="h-5 w-5" />}
              title={`${renewals.isLoading ? '…' : due} sắp gia hạn`}
              text="Gói tin hoặc gói Săn hết hạn trong 30 ngày, hoặc quá hạn dưới 14 ngày."
            />
          </Link>
          {deals.slice(0, 4).map((deal) => (
            <Link key={deal.id} href="/crm/pipeline" className="block h-full">
              <CrmCard
                tone="indigo"
                badge={isFresh(deal.createdAt) ? 'Mới' : undefined}
                icon={<Receipt className="h-5 w-5" />}
                title={deal.companyName}
                text={`${deal.title} · ${formatVnd(deal.listPriceVnd)} · ${stageName(board.data?.stages ?? [], deal.stageCode)}`}
                meta={formatWhen(deal.createdAt)}
              />
            </Link>
          ))}
        </CrmCardGrid>
      ) : null}
      {board.data && needle ? (
        matchedLeads.length + matchedDeals.length === 0 ? (
          <CrmEmpty>Không thấy lead hoặc deal khớp “{needle}”.</CrmEmpty>
        ) : (
          <CrmCardGrid>
            {matchedLeads.slice(0, 8).map((lead) => (
              <Link key={lead.id} href="/crm/leads" className="block h-full">
                <CrmCard
                  tone="sky"
                  icon={<Building2 className="h-5 w-5" />}
                  title={lead.companyName}
                  text={`${lead.contactName} · ${lead.contactPhone}`}
                  meta={lead.leadCode}
                />
              </Link>
            ))}
            {matchedDeals.slice(0, 8).map((deal) => (
              <Link key={deal.id} href="/crm/pipeline" className="block h-full">
                <CrmCard
                  tone="violet"
                  icon={<Kanban className="h-5 w-5" />}
                  title={deal.companyName}
                  text={`${deal.title} · ${formatVnd(deal.listPriceVnd)}`}
                  meta={deal.dealCode}
                />
              </Link>
            ))}
          </CrmCardGrid>
        )
      ) : null}
      {board.data && !needle && due > 0 ? (
        <CrmCardGrid columns={3}>
          {renewals.data?.slice(0, 3).map((row) => (
            <Link key={`${row.kind}-${row.companyId}`} href="/crm/renewals" className="block h-full">
              <CrmCard
                tone={row.daysLeft < 0 ? 'rose' : 'orange'}
                icon={<CalendarClock className="h-5 w-5" />}
                title={`${row.companyName} · ${row.planName}`}
                text={`${row.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'} · ${renewalLabel(row.daysLeft)}. Mở deal gia hạn không đổi gói hiện tại.`}
              />
            </Link>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

function stageName(stages: { code: string; name: string }[], code: string): string {
  return stages.find((stage) => stage.code === code)?.name ?? code;
}
