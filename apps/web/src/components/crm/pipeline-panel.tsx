'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CrmPlanKind } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd, isFresh, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmDeal, fetchCrmPlans, moveCrmDeal } from '@/lib/crm';

const TONE: Record<string, string> = {
  new: 'bg-sky-50 text-sky-600',
  consulting: 'bg-violet-50 text-violet-600',
  quoted: 'bg-indigo-50 text-indigo-600',
  awaiting_payment: 'bg-orange-50 text-orange-500',
  won: 'bg-emerald-50 text-emerald-600',
  lost: 'bg-rose-50 text-rose-500',
};

export function CrmPipelinePanel() {
  const board = useCrmBoard();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ['crm-plan-options'],
    queryFn: fetchCrmPlans,
  });

  const addDeal = useMutation({
    mutationFn: () => {
      const plan = plans.data?.find((item) => `${item.kind}:${item.code}` === planKey);
      return createCrmDeal({
        leadId,
        title,
        planKind: plan?.kind ?? null,
        planCode: plan?.code ?? null,
      });
    },
    onSuccess: () => {
      setTitle('');
      setPlanKey('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-renewals'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được deal')),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; stageCode: string }) => moveCrmDeal(input.id, { stageCode: input.stageCode }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không chuyển được bước')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    addDeal.mutate();
  }

  const leads = (board.data?.leads ?? []).filter((lead) => lead.status !== 'unqualified');
  const stages = board.data?.stages ?? [];

  return (
    <CrmFrame
      kicker="Một phễu cho gói tin và gói Săn"
      title="Theo deal từ lúc chào đến lúc thu tiền"
      description="Chọn gói để lưu giá niêm yết. Sang Chờ thanh toán thì tạo đơn cho nhà tuyển dụng. Cột Đã chốt không tự bật gói."
      placeholder="Tìm deal theo tên nhà máy hoặc tên gói"
      search={{ value: query, onChange: setQuery }}
      footnote="Giá trên thẻ là giá chưa VAT. CRM không gán gói."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] lg:grid-cols-4">
        <select
          className={crmFieldClass}
          value={leadId}
          required
          onChange={(event) => {
            const next = event.target.value;
            setLeadId(next);
            const lead = leads.find((item) => item.id === next);
            if (lead) setTitle(`Bán gói — ${lead.companyName}`);
          }}
        >
          <option value="">Chọn lead</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.companyName}
            </option>
          ))}
        </select>
        <input className={crmFieldClass} placeholder="Tiêu đề deal" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <select className={crmFieldClass} value={planKey} onChange={(event) => setPlanKey(event.target.value)}>
          <option value="">Chưa chọn gói</option>
          {plans.data?.map((plan) => (
            <option key={`${plan.kind}:${plan.code}`} value={`${plan.kind}:${plan.code}`}>
              {plan.kind === 'sourcing' ? 'Săn' : 'Tin'} · {plan.name} · {formatVnd(plan.priceVnd)}
            </option>
          ))}
        </select>
        <button type="submit" className={crmButtonClass} disabled={addDeal.isPending || leads.length === 0}>
          {addDeal.isPending ? 'Đang lưu…' : 'Tạo deal'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải phễu…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được phễu bán gói.</CrmEmpty> : null}
      {board.data ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const cards = (board.data?.deals ?? []).filter(
              (deal) =>
                deal.stageId === stage.id &&
                matchesQuery(query, [deal.companyName, deal.title, deal.planCode, deal.dealCode]),
            );
            return (
              <section key={stage.id} className="w-[250px] shrink-0 rounded-[22px] bg-white/70 p-3 shadow-[0_8px_24px_rgba(91,76,219,0.05)]">
                <h2 className="px-1 text-xs font-semibold text-slate-500">
                  {stage.name} · {cards.length}
                </h2>
                <div className="mt-3 space-y-2">
                  {cards.map((deal) => (
                    <article key={deal.id} className="relative rounded-2xl bg-white p-3.5 shadow-sm">
                      {isFresh(deal.createdAt) ? (
                        <span className="absolute right-3 top-3 rounded-full bg-[#ff4d4f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Mới
                        </span>
                      ) : null}
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE[stage.code] ?? TONE.new}`}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{deal.companyName}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {deal.planCode ? `${planLabel(deal.planKind)} ${deal.planCode}` : deal.title}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#4c3ec9]">{formatVnd(deal.listPriceVnd)}</p>
                      {stage.code === 'won' && deal.billingOrderStatus !== 'paid' ? (
                        <p className="mt-1 text-[11px] text-slate-400">Cột này không gán gói</p>
                      ) : null}
                      {deal.billingOrderStatus === 'paid' ? (
                        <p className="mt-1 text-[11px] text-emerald-600">Đã thu. Gói gán theo đơn.</p>
                      ) : null}
                      {deal.checkoutUrl ? (
                        <a href={deal.checkoutUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-semibold text-[#4c3ec9]">
                          Link thanh toán cho nhà tuyển dụng
                        </a>
                      ) : null}
                      <select
                        className="mt-3 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                        value={deal.stageCode}
                        disabled={move.isPending}
                        onChange={(event) => move.mutate({ id: deal.id, stageCode: event.target.value })}
                      >
                        {stages.map((option) => (
                          <option key={option.id} value={option.code}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </CrmFrame>
  );
}

function planLabel(kind: CrmPlanKind | null): string {
  return kind === 'sourcing' ? 'Săn' : 'Tin';
}
