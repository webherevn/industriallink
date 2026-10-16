'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { CrmPlanKind } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd, formatWhen, isFresh, matchesQuery } from '@/components/crm/format';
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
  const [lostDraft, setLostDraft] = useState<{ id: string; reason: string } | null>(null);

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
    mutationFn: (input: { id: string; stageCode: string; lostReason?: string }) =>
      moveCrmDeal(input.id, { stageCode: input.stageCode, lostReason: input.lostReason }),
    onSuccess: () => {
      setError(null);
      setLostDraft(null);
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
      description="Chọn gói để lưu giá niêm yết. Các cột chỉ là bước bán. Khách thanh toán trên inlink. CRM không tạo đơn, không bật gói và không ghi hoa hồng."
      placeholder="Tìm deal theo tên nhà máy hoặc tên gói"
      search={{ value: query, onChange: setQuery }}
      footnote="Giá niêm yết chưa VAT. Dòng đã thanh toán là đơn của deal này và không đổi cột."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface lg:grid-cols-4">
        <CrmSelect
          value={leadId}
          required
          placeholder="Chọn lead"
          options={leads.map((lead) => ({ value: lead.id, label: lead.companyName }))}
          onChange={(next) => {
            setLeadId(next);
            const lead = leads.find((item) => item.id === next);
            if (lead) setTitle(`Bán gói — ${lead.companyName}`);
          }}
        />
        <input className={crmFieldClass} placeholder="Tiêu đề deal" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <CrmSelect
          value={planKey}
          placeholder="Chưa chọn gói"
          options={(plans.data ?? []).map((plan) => ({
            value: `${plan.kind}:${plan.code}`,
            label: `${plan.kind === 'sourcing' ? 'Săn' : 'Tin'} · ${plan.name} · ${formatVnd(plan.priceVnd)}`,
          }))}
          onChange={setPlanKey}
        />
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
              <section key={stage.id} className="w-[250px] shrink-0 rounded-[22px] bg-white/70 p-3 crm-surface">
                <h2 className="px-1 text-xs font-semibold text-slate-500">
                  {stage.name} · {cards.length}
                </h2>
                <div className="mt-3 space-y-2">
                  {cards.map((deal) => (
                    <article key={deal.id} className="crm-surface relative rounded-2xl bg-white p-3.5">
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
                      {deal.paidAt ? (
                        <>
                          <p className="mt-1 text-[11px] font-medium leading-relaxed text-emerald-700">
                            Đã thanh toán {formatVnd(deal.paidAmountVnd)} · {formatWhen(deal.paidAt)}
                          </p>
                          <Link
                            href={`/crm/finance?q=${encodeURIComponent(deal.paidInvoiceNumber ?? deal.paidCompanyName ?? deal.companyName)}`}
                            className={`mt-1 block text-[11px] font-medium leading-relaxed underline ${
                              deal.paidInvoiceNumber ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {deal.paidInvoiceNumber ? `Hóa đơn ${deal.paidInvoiceNumber}` : 'Chưa ghi số hóa đơn'}
                          </Link>
                        </>
                      ) : null}
                      {stage.code === 'won' ? (
                        <p className="mt-1 text-[11px] text-slate-400">Cột này không bật gói và không ghi hoa hồng</p>
                      ) : null}
                      {deal.lostReason ? <p className="mt-1 text-[11px] text-rose-600">Lý do mất: {deal.lostReason}</p> : null}
                      {deal.companyId ? (
                        <Link href={`/crm/companies/${deal.companyId}`} className={`${crmActionClass} mt-3 w-full`}>
                          Hồ sơ công ty
                        </Link>
                      ) : null}
                      <div className="mt-3">
                        <CrmSelect
                          compact
                          value={lostDraft?.id === deal.id ? 'lost' : deal.stageCode}
                          disabled={move.isPending}
                          options={stages.map((option) => ({ value: option.code, label: option.name }))}
                          onChange={(stageCode) => {
                            if (stageCode === 'lost') {
                              setLostDraft({ id: deal.id, reason: deal.lostReason ?? '' });
                              return;
                            }
                            setLostDraft(null);
                            move.mutate({ id: deal.id, stageCode });
                          }}
                        />
                        {lostDraft?.id === deal.id ? (
                          <form
                            className="mt-2 grid gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              move.mutate({ id: deal.id, stageCode: 'lost', lostReason: lostDraft.reason });
                            }}
                          >
                            <input
                              className={crmFieldClass}
                              placeholder="Lý do mất"
                              value={lostDraft.reason}
                              onChange={(event) => setLostDraft({ id: deal.id, reason: event.target.value })}
                              required
                            />
                            <button type="submit" className={crmButtonClass} disabled={move.isPending || lostDraft.reason.trim().length < 2}>
                              Ghi mất
                            </button>
                          </form>
                        ) : null}
                      </div>
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
