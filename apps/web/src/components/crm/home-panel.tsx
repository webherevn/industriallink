'use client';

import {
  Building2,
  Contact,
  CalendarCheck,
  FileText,
  Inbox,
  CalendarClock,
  Kanban,
  PieChart,
  Landmark,
  NotebookPen,
  Percent,
  Receipt,
  Scale,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmChip, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { followUpLabel, formatVnd, formatWhen, isFresh, leadSourceLabel, matchesQuery, renewalLabel } from '@/components/crm/format';
import { useCrmBoard, useCrmRenewals } from '@/components/crm/use-crm-board';
import { fetchCrmFollowUps, fetchCrmInvoices, fetchCrmPartners, fetchCrmUnclaimed } from '@/lib/crm';

export function CrmHomePanel() {
  const board = useCrmBoard();
  const renewals = useCrmRenewals();
  const invoices = useQuery({ queryKey: ['crm-invoices'], queryFn: fetchCrmInvoices });
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const unclaimed = useQuery({ queryKey: ['crm-unclaimed'], queryFn: fetchCrmUnclaimed });
  const followUps = useQuery({ queryKey: ['crm-follow-ups'], queryFn: fetchCrmFollowUps });
  const missingInvoices = (invoices.data?.orders ?? []).filter((order) => !order.invoiceNumber).length;
  const unpaidSignups = (partners.data ?? []).reduce((sum, partner) => sum + partner.signups.length, 0);
  const [query, setQuery] = useState('');
  const leads = board.data?.leads ?? [];
  const deals = board.data?.deals ?? [];
  const openLeads = leads.filter((lead) => lead.status === 'open').length;
  const running = deals.filter((deal) => deal.stageCode !== 'won' && deal.stageCode !== 'lost').length;
  const waiting = deals.filter((deal) => deal.stageCode === 'awaiting_payment').length;
  const due = renewals.data?.length ?? 0;
  const needle = query.trim();
  const matchedLeads = leads.filter((lead) =>
    matchesQuery(query, [lead.companyName, lead.contactName, lead.contactPhone, lead.taxCode, lead.leadCode, leadSourceLabel(lead.source), lead.partnerName, lead.partnerCode]),
  );
  const matchedDeals = deals.filter((deal) =>
    matchesQuery(query, [deal.companyName, deal.title, deal.planCode, deal.dealCode]),
  );

  return (
    <CrmFrame
      kicker="Lead, deal đang chạy và khách sắp hết gói"
      title="Bàn làm việc của đội kinh doanh"
      description="Số lấy từ lead và deal đang ghi trong CRM. Chốt deal không tự bật gói nhà tuyển dụng."
      placeholder="Tìm lead, deal hoặc nhà máy"
      search={{ value: query, onChange: setQuery }}
      footnote="CRM không gán gói và không cộng Credit."
      chips={
        <>
          <CrmChip href="/crm/leads" icon={<Building2 className="h-4 w-4" />} label="Lead" />
          <CrmChip href="/crm/quotes" icon={<FileText className="h-4 w-4" />} label="Báo giá" />
          <CrmChip href="/crm/pipeline" icon={<Kanban className="h-4 w-4" />} label="Phễu bán gói" />
          <CrmChip href="/crm/customers" icon={<Contact className="h-4 w-4" />} label="Khách hàng" />
          <CrmChip href="/crm/inbox" icon={<Inbox className="h-4 w-4" />} label="Khách tự mua" />
          <CrmChip href="/crm/reports" icon={<PieChart className="h-4 w-4" />} label="Báo cáo" />
          <CrmChip href="/crm/activities" icon={<NotebookPen className="h-4 w-4" />} label="Nhật ký" />
          <CrmChip href="/crm/renewals" icon={<CalendarClock className="h-4 w-4" />} label="Gia hạn" />
          <CrmChip href="/crm/finance" icon={<Receipt className="h-4 w-4" />} label="Hóa đơn" />
          <CrmChip href="/crm/finance/reconciliation" icon={<Scale className="h-4 w-4" />} label="Đối soát" />
          <CrmChip href="/crm/finance/periods" icon={<CalendarCheck className="h-4 w-4" />} label="Kỳ chốt" />
          <CrmChip href="/crm/finance/accounting" icon={<Landmark className="h-4 w-4" />} label="Kế toán" />
          <CrmChip href="/crm/partners" icon={<Users className="h-4 w-4" />} label="Cộng tác viên" />
          <CrmChip href="/crm/signups" icon={<UserPlus className="h-4 w-4" />} label="Đăng ký chưa trả" />
          <CrmChip href="/crm/settings/commission" icon={<Percent className="h-4 w-4" />} label="Hoa hồng" />
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
          <Link href="/crm/inbox" className="block h-full">
            <CrmCard
              tone="indigo"
              icon={<Inbox className="h-5 w-5" />}
              title={`${unclaimed.isLoading ? '…' : (unclaimed.data?.length ?? 0)} khách tự mua`}
              text="Đã thanh toán gói trên web và chưa có lead."
            />
          </Link>
          <Link href="/crm/activities" className="block h-full">
            <CrmCard
              tone="violet"
              icon={<NotebookPen className="h-5 w-5" />}
              title={`${followUps.isLoading ? '…' : (followUps.data?.length ?? 0)} lịch hẹn`}
              text={followUps.data?.[0]?.nextFollowUpAt ? followUpLabel(followUps.data[0].nextFollowUpAt) : 'Chưa có ngày gọi lại.'}
            />
          </Link>
          <Link href="/crm/pipeline" className="block h-full">
            <CrmCard tone="violet" icon={<Kanban className="h-5 w-5" />} title={`${running} deal đang chạy`} text="Gói tin và gói Săn còn trong phễu." />
          </Link>
          <Link href="/crm/pipeline" className="block h-full">
            <CrmCard tone="orange" icon={<Wallet className="h-5 w-5" />} title={`${waiting} chờ thanh toán`} text="Khách tự thanh toán trên inlink. CRM không tạo đơn." />
          </Link>
          <Link href="/crm/signups" className="block h-full">
            <CrmCard
              tone="indigo"
              icon={<UserPlus className="h-5 w-5" />}
              title={`${partners.isLoading ? '…' : unpaidSignups} đã đăng ký, chưa thanh toán`}
              text="Nhà tuyển dụng mở link cộng tác viên và tạo tài khoản. Hoa hồng chỉ ghi khi họ thanh toán gói có giá."
            />
          </Link>
          <Link href="/crm/finance" className="block h-full">
            <CrmCard
              tone="rose"
              icon={<Receipt className="h-5 w-5" />}
              title={`${invoices.isLoading ? '…' : missingInvoices} chưa ghi số hóa đơn`}
              text="Đơn gói đã thanh toán trên inlink. Ghi số không thu thêm và không bật gói."
            />
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
                text={`${deal.title} · ${formatVnd(deal.listPriceVnd)} · ${stageName(board.data?.stages ?? [], deal.stageCode)}${deal.paidAt ? ` · Đã thanh toán ${formatVnd(deal.paidAmountVnd)} · ${deal.paidInvoiceNumber ? `Hóa đơn ${deal.paidInvoiceNumber}` : 'Chưa ghi số hóa đơn'}` : ''}`}
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
                  text={`${lead.contactName} · ${lead.contactPhone} · ${lead.partnerName ? `${lead.partnerName} (${lead.partnerCode})` : leadSourceLabel(lead.source)}`}
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
