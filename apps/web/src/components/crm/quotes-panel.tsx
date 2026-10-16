'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPlanKind, CrmPlanOption } from '@industriallink/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd, formatWhen } from '@/components/crm/format';
import { createCrmQuote, fetchCrmPlans, fetchCrmQuotes } from '@/lib/crm';

export function CrmQuotesPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['crm-plans'], queryFn: fetchCrmPlans });
  const quotes = useQuery({ queryKey: ['crm-quotes'], queryFn: fetchCrmQuotes });
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options = (plans.data ?? []).map((plan) => ({
    value: planKey(plan),
    label: `${plan.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'} · ${plan.name} · ${formatVnd(plan.priceVnd)}`,
  }));
  const save = useMutation({
    mutationFn: () => {
      const first = splitPlan(option1);
      const second = option2 ? splitPlan(option2) : null;
      if (!first) throw new Error('Chọn phương án 1');
      return createCrmQuote({
        companyName,
        contactName,
        taxCode: taxCode || null,
        option1Kind: first.kind,
        option1Code: first.code,
        option2Kind: second?.kind ?? null,
        option2Code: second?.code ?? null,
        note: note || null,
      });
    },
    onSuccess: async (row) => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['crm-quotes'] });
      router.push(`/crm/quotes/${row.id}`);
    },
    onError: (err) => setError(errorText(err, 'Không lập được báo giá')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <CrmFrame
      kicker="Giá niêm yết chưa VAT"
      title="Bảng chào giá"
      description="Chọn phương án 1 và, nếu cần, phương án 2. Giá lấy từ gói SuperAdmin. Xuất tờ không tạo đơn và không bật gói."
      footnote="Khách vẫn tự thanh toán trên inlink. Tờ này chỉ để gửi."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] md:grid-cols-2">
        <input className={crmFieldClass} placeholder="Tên công ty" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Người nhận" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
        <input className={crmFieldClass} placeholder="Ghi chú" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
        <CrmSelect value={option1} required placeholder={plans.isLoading ? 'Đang tải gói…' : 'Phương án 1'} options={options} onChange={setOption1} />
        <CrmSelect value={option2} placeholder="Phương án 2, nếu có" options={[{ value: '', label: 'Không chọn phương án 2' }, ...options]} onChange={setOption2} />
        <button type="submit" className={`${crmButtonClass} md:col-span-2`} disabled={save.isPending || !option1}>
          {save.isPending ? 'Đang lập…' : 'Lập báo giá'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {quotes.isLoading ? <CrmEmpty>Đang tải báo giá…</CrmEmpty> : null}
      {quotes.isError ? <CrmEmpty>Không tải được danh sách báo giá.</CrmEmpty> : null}
      {quotes.data && quotes.data.length === 0 ? <CrmEmpty>Chưa có báo giá.</CrmEmpty> : null}
      {quotes.data && quotes.data.length > 0 ? (
        <section className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Số</th>
                  <th className="px-4 py-3">Công ty</th>
                  <th className="px-4 py-3">Người lập</th>
                  <th className="px-4 py-3">Phương án</th>
                  <th className="px-4 py-3">Lập lúc</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {quotes.data.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.quoteCode}</td>
                    <td className="px-4 py-3 text-slate-700">{row.companyName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.ownerName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.option1Name}
                      {row.option2Name ? ` · ${row.option2Name}` : ''}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatWhen(row.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/crm/quotes/${row.id}`} className={crmActionClass}>
                        Xem tờ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </CrmFrame>
  );
}

function planKey(plan: CrmPlanOption): string {
  return `${plan.kind}:${plan.code}`;
}

function splitPlan(value: string): { kind: CrmPlanKind; code: string } | null {
  const [kind, code] = value.split(':');
  if ((kind !== 'platform' && kind !== 'sourcing') || !code) return null;
  return { kind, code };
}
