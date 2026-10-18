'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CrmEmpty, crmButtonClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { QuoteDocument } from '@/components/crm/quote-document';
import { acceptCrmQuote, collectCrmInstallment, fetchCrmQuote, fetchCrmQuoteForm, fetchCrmQuoteFormLogoObjectUrl } from '@/lib/crm';

export function CrmQuoteSheet({ quoteId }: { quoteId: string }) {
  const qc = useQueryClient();
  const quote = useQuery({ queryKey: ['crm-quote', quoteId], queryFn: () => fetchCrmQuote(quoteId) });
  const form = useQuery({ queryKey: ['crm-quote-form'], queryFn: fetchCrmQuoteForm });
  const logo = useQuery({
    queryKey: ['crm-quote-form-logo'],
    queryFn: fetchCrmQuoteFormLogoObjectUrl,
    enabled: Boolean(form.data?.hasLogo),
  });
  const [error, setError] = useState<string | null>(null);
  const row = quote.data;
  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['crm-quote', quoteId] });
    await qc.invalidateQueries({ queryKey: ['crm-quotes'] });
    await qc.invalidateQueries({ queryKey: ['crm-receivables'] });
    await qc.invalidateQueries({ queryKey: ['crm-workspace'] });
  };
  const accept = useMutation({
    mutationFn: () => acceptCrmQuote(quoteId),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err, 'Không chốt được hợp đồng')),
  });
  const collect = useMutation({
    mutationFn: (installmentId: string) => collectCrmInstallment(quoteId, installmentId),
    onSuccess: refresh,
    onError: (err) => setError(errorText(err, 'Không ghi được đợt đã thu')),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/crm/quotes" className="text-sm font-semibold text-[#4c3ec9]">
          Về danh sách
        </Link>
        <button type="button" className="rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}>
          Xuất PDF
        </button>
      </div>
      {quote.isLoading ? <CrmEmpty>Đang tải báo giá…</CrmEmpty> : null}
      {quote.isError ? <CrmEmpty>Không tải được báo giá.</CrmEmpty> : null}
      {row ? (
        <>
          <p className="text-center text-sm text-slate-500 print:hidden">
            {sheetStatus(row.status)} · {row.ownerName}
            {row.dealTitle ? ` · ${row.dealTitle} · ${row.dealCode}` : ''}
          </p>
          <QuoteDocument
            quote={row}
            form={form.data ?? null}
            logoUrl={logo.data ?? null}
            pendingId={collect.isPending ? collect.variables ?? null : null}
            onCollect={(id) => collect.mutate(id)}
          />
          {row.quoteKind === 'enterprise' && row.status !== 'accepted' ? (
            <div className="print:hidden">
              <button type="button" className={crmButtonClass} disabled={accept.isPending} onClick={() => accept.mutate()}>
                {accept.isPending ? 'Đang chốt…' : 'Chốt hợp đồng'}
              </button>
              <p className="mt-2 text-xs text-slate-500">Chốt tờ thì các đợt thành công nợ. Không tạo đơn và không bật gói.</p>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-600 print:hidden">{error}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function sheetStatus(status: string): string {
  if (status === 'accepted') return 'Đã chốt hợp đồng';
  if (status === 'sent') return 'Đã gửi';
  return 'Bản thảo';
}
