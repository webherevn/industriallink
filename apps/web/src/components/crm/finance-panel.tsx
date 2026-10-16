'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CrmDealView } from '@industriallink/contracts';
import { Receipt } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { issueCrmInvoice } from '@/lib/crm';

export function CrmFinancePanel() {
  const board = useCrmBoard();
  const [query, setQuery] = useState('');
  const stages = board.data?.stages ?? [];
  const deals = (board.data?.deals ?? []).filter(
    (deal) =>
      deal.stageCode !== 'lost' &&
      matchesQuery(query, [deal.companyName, deal.dealCode, deal.title, deal.planCode, deal.invoiceNumber]),
  );

  return (
    <CrmFrame
      kicker="Ghi số đã xuất, chưa tính thêm thuế"
      title="Hóa đơn của deal"
      description="Giá trên deal là giá niêm yết chưa VAT. Thuế suất sẽ cấu hình sau. Khách tự thanh toán trên inlink. Màn này không bật gói."
      placeholder="Tìm deal, khách hoặc số hóa đơn"
      search={{ value: query, onChange: setQuery }}
      footnote="Chưa có công nợ. Ghi số hóa đơn không thu tiền và không gán gói."
    >
      {board.isLoading ? <CrmEmpty>Đang tải hóa đơn…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được danh sách deal.</CrmEmpty> : null}
      {board.data && deals.length === 0 ? <CrmEmpty>Chưa có deal để ghi hóa đơn.</CrmEmpty> : null}
      {deals.length > 0 ? (
        <CrmCardGrid columns={3}>
          {deals.map((deal) => {
            const stage = stages.find((item) => item.code === deal.stageCode)?.name ?? deal.stageCode;
            return (
              <CrmCard
                key={deal.id}
                tone={deal.invoiceStatus === 'issued' ? 'green' : 'violet'}
                icon={<Receipt className="h-5 w-5" />}
                title={`${deal.companyName} · ${formatVnd(deal.listPriceVnd)}`}
                text={`${stage}. Giá chưa VAT.`}
                meta={deal.dealCode}
              >
                <InvoiceForm key={`${deal.id}:${deal.invoiceNumber ?? ''}`} deal={deal} />
              </CrmCard>
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

function InvoiceForm({ deal }: { deal: CrmDealView }) {
  const queryClient = useQueryClient();
  const [number, setNumber] = useState(deal.invoiceNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => issueCrmInvoice(deal.id, { invoiceNumber: number }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không lưu được số hóa đơn')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      {deal.invoiceStatus === 'issued' && deal.invoiceIssuedAt ? (
        <p className="text-[11px] text-emerald-700">Đã ghi {formatWhen(deal.invoiceIssuedAt)}</p>
      ) : (
        <p className="text-[11px] text-slate-400">Chưa ghi số hóa đơn</p>
      )}
      <input
        className={crmFieldClass}
        value={number}
        maxLength={64}
        placeholder="Số hóa đơn"
        onChange={(event) => setNumber(event.target.value)}
        required
      />
      <button type="submit" className={crmButtonClass} disabled={save.isPending}>
        {save.isPending ? 'Đang lưu…' : deal.invoiceStatus === 'issued' ? 'Cập nhật số' : 'Ghi hóa đơn'}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </form>
  );
}
