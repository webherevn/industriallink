'use client';

import {
  BarChart3,
  BookOpen,
  Building2,
  Contact,
  CalendarCheck,
  Inbox,
  CalendarClock,
  CircleDollarSign,
  Flag,
  Flame,
  Kanban,
  Megaphone,
  Radio,
  FileText,
  Landmark,
  NotebookPen,
  Percent,
  Receipt,
  Scale,
  ShoppingBag,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CrmCard, CrmCardGrid, CrmChip, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { followUpLabel, formatVnd, formatWhen, isFresh, leadSourceLabel, matchesQuery, renewalLabel } from '@/components/crm/format';
import { CrmWorkspaceBoard } from '@/components/crm/workspace-board';
import { useCrmBoard, useCrmRenewals } from '@/components/crm/use-crm-board';
import { fetchCrmCustomers, fetchCrmFollowUps, fetchCrmInvoices, fetchCrmMarketing, fetchCrmPartners, fetchCrmUnclaimed } from '@/lib/crm';

export function CrmHomePanel() {
  const board = useCrmBoard();
  const renewals = useCrmRenewals();
  const invoices = useQuery({ queryKey: ['crm-invoices'], queryFn: fetchCrmInvoices });
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const unclaimed = useQuery({ queryKey: ['crm-unclaimed'], queryFn: fetchCrmUnclaimed });
  const followUps = useQuery({ queryKey: ['crm-follow-ups'], queryFn: fetchCrmFollowUps });
  const channels = useQuery({ queryKey: ['crm-marketing'], queryFn: fetchCrmMarketing });
  const customers = useQuery({ queryKey: ['crm-customers', ''], queryFn: () => fetchCrmCustomers('') });
  const hotCustomers = (customers.data ?? [])
    .filter((row) => (row.hotSignals?.length ?? 0) > 0)
    .sort((a, b) => {
      const rank = (list: typeof a.hotSignals) =>
        list?.some((s) => s.severity === 'hot') ? 2 : list?.some((s) => s.severity === 'warn') ? 1 : 0;
      const diff = rank(b.hotSignals) - rank(a.hotSignals);
      if (diff !== 0) return diff;
      return (b.hotSignals?.length ?? 0) - (a.hotSignals?.length ?? 0);
    });
  const sourceChannels = channels.data?.channels ?? [];
  const missingInvoices = (invoices.data?.orders ?? []).filter((order) => !order.invoiceNumber).length;
  const unpaidSignups = (partners.data ?? []).reduce((sum, partner) => sum + partner.signups.length, 0);
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  useEffect(() => setQuery(urlQuery), [urlQuery]);
  const leads = board.data?.leads ?? [];
  const deals = board.data?.deals ?? [];
  const openLeads = leads.filter((lead) => lead.status === 'open').length;
  const running = deals.filter((deal) => deal.stageCode !== 'won' && deal.stageCode !== 'lost').length;
  const waiting = deals.filter((deal) => deal.stageCode === 'awaiting_payment').length;
  const due = renewals.data?.length ?? 0;
  const needle = query.trim();
  const matchedLeads = leads.filter((lead) =>
    matchesQuery(query, [lead.companyName, lead.contactName, lead.contactPhone, lead.taxCode, lead.leadCode, leadSourceLabel(lead.source, sourceChannels), lead.partnerName, lead.partnerCode]),
  );
  const matchedDeals = deals.filter((deal) =>
    matchesQuery(query, [deal.companyName, deal.title, deal.planCode, deal.dealCode]),
  );

  return (
    <CrmFrame
      kicker="Lead, deal đang chạy và khách sắp hết gói"
      title="Bàn làm việc của đội kinh doanh"
      description="Tháng này hiện đơn đã trả, công nợ Enterprise, nhân viên xuất sắc và việc của người phụ trách. Chốt deal không tự bật gói."
      placeholder="Tìm lead, deal hoặc nhà máy"
      search={{ value: query, onChange: setQuery }}
      footnote="CRM không gán gói và không cộng Credit."
      chips={
        <>
          <CrmChip href="/crm/leads" icon={<Building2 className="h-4 w-4" />} label="Tiềm năng" />
          <CrmChip href="/crm/customers" icon={<Contact className="h-4 w-4" />} label="Khách hàng" />
          <CrmChip href="/crm/pipeline" icon={<Kanban className="h-4 w-4" />} label="Cơ hội" />
          <CrmChip href="/crm/quotes" icon={<FileText className="h-4 w-4" />} label="Báo giá" />
          <CrmChip href="/crm/orders" icon={<ShoppingBag className="h-4 w-4" />} label="Đơn hàng" />
          <CrmChip href="/crm/bao-cao" icon={<BarChart3 className="h-4 w-4" />} label="Báo cáo" />
          <CrmChip href="/crm/marketing" icon={<Megaphone className="h-4 w-4" />} label="Marketing" />
          <CrmChip href="/crm/marketing/campaigns" icon={<Flag className="h-4 w-4" />} label="Chiến dịch" />
          <CrmChip href="/crm/marketing/channels" icon={<Radio className="h-4 w-4" />} label="Kênh" />
          <CrmChip href="/crm/marketing/costs" icon={<CircleDollarSign className="h-4 w-4" />} label="Chi phí" />
          <CrmChip href="/crm/activities" icon={<NotebookPen className="h-4 w-4" />} label="Nhật ký" />
          <CrmChip href="/crm/renewals" icon={<CalendarClock className="h-4 w-4" />} label="Gia hạn" />
          <CrmChip href="/crm/finance" icon={<Receipt className="h-4 w-4" />} label="Hóa đơn" />
          <CrmChip href="/crm/finance/reconciliation" icon={<Scale className="h-4 w-4" />} label="Đối soát" />
          <CrmChip href="/crm/finance/periods" icon={<CalendarCheck className="h-4 w-4" />} label="Kỳ chốt" />
          <CrmChip href="/crm/finance/accounting" icon={<Landmark className="h-4 w-4" />} label="Kế toán" />
          <CrmChip href="/crm/partners" icon={<Users className="h-4 w-4" />} label="Cộng tác viên" />
          <CrmChip href="/crm/signups" icon={<UserPlus className="h-4 w-4" />} label="Đăng ký chưa trả" />
          <CrmChip href="/crm/settings/commission" icon={<Percent className="h-4 w-4" />} label="Hoa hồng" />
          <CrmChip href="/crm/docs" icon={<BookOpen className="h-4 w-4" />} label="Tài liệu" />
        </>
      }
    >
      {!needle ? <CrmWorkspaceBoard /> : null}
      {!needle && hotCustomers.length > 0 ? (
        <section className="rounded-[22px] bg-white p-5 crm-surface">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Flame className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  NTD cần hỗ trợ ngay ({hotCustomers.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng hợp tự động theo tín hiệu hoạt động trên inLink trong phạm vi phụ trách của bạn.
                </p>
              </div>
            </div>
            <Link
              href="/crm/customers?filter=hot"
              className="text-xs font-semibold text-[#4c3ec9] hover:underline"
            >
              Xem tất cả trong Sổ khách hàng →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {hotCustomers.slice(0, 6).map((row) => (
              <li
                key={row.companyId}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/crm/companies/${row.companyId}`}
                      className="font-semibold text-slate-900 hover:text-[#4c3ec9] hover:underline"
                    >
                      {row.companyName}
                    </Link>
                    {row.contactPhone ? (
                      <span className="text-xs text-slate-500">{row.contactPhone}</span>
                    ) : null}
                    {row.ownerName ? (
                      <span className="text-xs text-slate-400">· {row.ownerName}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(row.hotSignals ?? []).slice(0, 3).map((sig) => (
                      <span
                        key={sig.code}
                        title={sig.detail}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                          sig.severity === 'hot'
                            ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
                            : sig.severity === 'warn'
                              ? 'bg-amber-50 text-amber-800 ring-amber-200/80'
                              : 'bg-sky-50 text-sky-700 ring-sky-200/80'
                        }`}
                      >
                        {sig.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {row.lastActivityAt ? (
                    <span className="text-xs text-slate-400">{formatWhen(row.lastActivityAt)}</span>
                  ) : null}
                  <Link
                    href={`/crm/companies/${row.companyId}`}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Xem hồ sơ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
                  text={`${lead.contactName} · ${lead.contactPhone} · ${lead.partnerName ? `${lead.partnerName} (${lead.partnerCode})` : leadSourceLabel(lead.source, sourceChannels)}`}
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
