'use client';

import { FileClock, Receipt } from 'lucide-react';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatVnd, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';

export function CrmFinancePanel() {
  const board = useCrmBoard();
  const [query, setQuery] = useState('');
  const stages = board.data?.stages ?? [];
  const deals = (board.data?.deals ?? []).filter((deal) =>
    matchesQuery(query, [deal.companyName, deal.dealCode, deal.title, deal.planCode]),
  );

  return (
    <CrmFrame
      kicker="Giá niêm yết là giá chưa VAT"
      title="Công nợ nhìn từ deal đang chạy"
      description="Màn này hiện giá đã chốt trên deal. Hóa đơn VAT và tiền đã thu sẽ gắn khi có đơn thanh toán. Chưa tính hoa hồng."
      placeholder="Tìm deal hoặc tên khách"
      search={{ value: query, onChange: setQuery }}
      footnote="Chưa ghi nhận VAT và chưa có đơn thanh toán từ CRM."
    >
      {board.isLoading ? <CrmEmpty>Đang tải công nợ…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được danh sách deal.</CrmEmpty> : null}
      {board.data && deals.length === 0 ? <CrmEmpty>Chưa có deal để theo dõi công nợ.</CrmEmpty> : null}
      {deals.length > 0 ? (
        <CrmCardGrid columns={3}>
          {deals.map((deal) => {
            const stage = stages.find((item) => item.code === deal.stageCode)?.name ?? deal.stageCode;
            return (
              <CrmCard
                key={deal.id}
                tone={deal.stageCode === 'won' ? 'green' : deal.stageCode === 'awaiting_payment' ? 'orange' : 'violet'}
                icon={deal.stageCode === 'won' ? <Receipt className="h-5 w-5" /> : <FileClock className="h-5 w-5" />}
                title={`${deal.companyName} · ${formatVnd(deal.listPriceVnd)}`}
                text={`${stage}. Giá chưa VAT. ${deal.billingOrderId ? 'Đã gắn đơn thanh toán.' : 'Chưa có đơn thanh toán.'} ${deal.stageCode === 'won' ? 'Gói chưa được gán.' : ''}`}
                meta={deal.dealCode}
              />
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
