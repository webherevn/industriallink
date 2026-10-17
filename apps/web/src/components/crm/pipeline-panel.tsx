'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Kanban, List } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { CrmDealView, CrmPlanKind, CrmStageView } from '@industriallink/contracts';
import { CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmDateField, CrmField, CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd, formatWhen, isFresh, matchesQuery, vietnamDay } from '@/components/crm/format';
import { ColumnPicker, RowActions, RowCheck, RowIconButton, canDeleteOwned, crmTableClass, crmTd, filterChipClass, SortableTh, sortRows, stickyActionsHead, stickyCell, stickyCheck, stickyIndex, useColumnSort, useRowSelection, useVisibleColumns } from '@/components/crm/table';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { fetchMe } from '@/lib/auth';
import { createCrmDeal, deleteCrmDeal, fetchCrmPlans, moveCrmDeal } from '@/lib/crm';

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
  const [expectedClose, setExpectedClose] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [stageFilter, setStageFilter] = useState('all');
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
        expectedCloseOn: expectedClose || null,
      });
    },
    onSuccess: () => {
      setTitle('');
      setPlanKey('');
      setExpectedClose('');
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
      kicker="Cơ hội bán gói tin và gói Săn"
      title="Theo deal từ lúc chào đến lúc thu tiền"
      description="Chọn gói để lưu giá niêm yết. Các cột chỉ là bước bán. Khách thanh toán trên inlink. CRM không tạo đơn, không bật gói và không ghi hoa hồng."
      placeholder="Tìm deal theo tên nhà máy hoặc tên gói"
      search={{ value: query, onChange: setQuery }}
      footnote="Giá niêm yết chưa VAT. Dòng đã thanh toán là đơn của deal này và không đổi cột."
    >
      <form onSubmit={onSubmit} className="grid items-end gap-3 rounded-[22px] bg-white p-4 crm-surface lg:grid-cols-5">
        <CrmField label="Tiềm năng *">
          <CrmSelect
            value={leadId}
            required
            placeholder="Chọn tiềm năng"
            options={leads.map((lead) => ({ value: lead.id, label: lead.companyName }))}
            onChange={(next) => {
              setLeadId(next);
              const lead = leads.find((item) => item.id === next);
              if (lead) setTitle(`Bán gói — ${lead.companyName}`);
            }}
          />
        </CrmField>
        <CrmField label="Tên cơ hội *">
          <input className={crmFieldClass} aria-label="Tên cơ hội" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </CrmField>
        <CrmField label="Gói">
          <CrmSelect
            value={planKey}
            placeholder="Chưa chọn gói"
            options={(plans.data ?? []).map((plan) => ({
              value: `${plan.kind}:${plan.code}`,
              label: `${plan.kind === 'sourcing' ? 'Săn' : 'Tin'} · ${plan.name} · ${formatVnd(plan.priceVnd)}`,
            }))}
            onChange={setPlanKey}
          />
        </CrmField>
        <CrmField label="Ngày kỳ vọng">
          <CrmDateField value={expectedClose} onChange={setExpectedClose} placeholder="Chưa chọn" />
        </CrmField>
        <button type="submit" className={crmButtonClass} disabled={addDeal.isPending || leads.length === 0}>
          {addDeal.isPending ? 'Đang lưu…' : 'Tạo cơ hội'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải phễu…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được phễu bán gói.</CrmEmpty> : null}
      {board.data ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={`${filterChipClass(view === 'list')} inline-flex items-center gap-1.5`} onClick={() => setView('list')}><List className="h-3.5 w-3.5" />Danh sách</button>
          <button type="button" className={`${filterChipClass(view === 'kanban')} inline-flex items-center gap-1.5`} onClick={() => setView('kanban')}><Kanban className="h-3.5 w-3.5" />Kanban</button>
        </div>
      ) : null}
      {board.data && view === 'list' ? (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={filterChipClass(stageFilter === 'all')} onClick={() => setStageFilter('all')}>Tất cả giai đoạn</button>
          {stages.map((stage) => (
            <button key={stage.id} type="button" className={filterChipClass(stageFilter === stage.code)} onClick={() => setStageFilter(stage.code)}>
              {stage.name}
            </button>
          ))}
        </div>
      ) : null}
      {board.data && view === 'list' ? (
        <DealTable
          deals={(board.data.deals ?? []).filter((deal) => (stageFilter === 'all' || deal.stageCode === stageFilter) && matchesDeal(query, deal))}
          stages={stages}
          plans={plans.data ?? []}
          query={query}
        />
      ) : null}
      {board.data && view === 'kanban' ? (
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

function matchesDeal(query: string, deal: CrmDealView): boolean {
  return matchesQuery(query, [deal.companyName, deal.title, deal.planCode, deal.dealCode, deal.ownerName]);
}

function stageListLabel(code: string, name: string): string {
  if (code === 'won') return 'Kết thúc thành công';
  if (code === 'lost') return 'Kết thúc thất bại';
  return name;
}

function dayText(value: string | null): string {
  if (!value) return '—';
  const day = value.length === 10 ? value : vietnamDay(value);
  const [year, month, date] = day.split('-');
  if (!year || !month || !date) return '—';
  return `${date}/${month}/${year}`;
}

function expectOrEnd(deal: CrmDealView): string {
  if (deal.stageCode === 'won') return dayText(deal.wonAt);
  if (deal.stageCode === 'lost') return dayText(deal.lostAt);
  return dayText(deal.expectedCloseOn);
}

function planInfo(deal: CrmDealView, plans: Array<{ kind: string; code: string; name: string }>): string {
  if (!deal.planCode) return 'Chưa chọn gói';
  const plan = plans.find((item) => item.kind === deal.planKind && item.code === deal.planCode);
  const kind = deal.planKind === 'sourcing' ? 'Gói Săn' : 'Gói tin';
  return plan ? `${kind} · ${plan.name}` : `${kind} · ${deal.planCode}`;
}

const DEAL_COLUMNS = [
  { key: 'title', label: 'Tên cơ hội' },
  { key: 'plan', label: 'Thông tin gói' },
  { key: 'amount', label: 'Số tiền' },
  { key: 'stage', label: 'Giai đoạn' },
  { key: 'date', label: 'Ngày kỳ vọng / kết thúc' },
  { key: 'owner', label: 'Người thực hiện' },
  { key: 'created', label: 'Ngày tạo' },
] as const;

type DealColumn = (typeof DEAL_COLUMNS)[number]['key'];

function DealTable({
  deals,
  stages,
  plans,
  query,
}: {
  deals: CrmDealView[];
  stages: CrmStageView[];
  plans: Array<{ kind: string; code: string; name: string }>;
  query: string;
}) {
  const sort = useColumnSort<DealColumn>('created', 'desc');
  const columns = useVisibleColumns<DealColumn>('crm-cols-deals', DEAL_COLUMNS.map((column) => column.key));
  const pick = useRowSelection();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeDeal = useMutation({
    mutationFn: deleteCrmDeal,
    onSuccess: () => {
      setRemoveError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-workspace'] });
    },
    onError: (err) => setRemoveError(errorText(err, 'Không xóa được cơ hội')),
  });
  const rows = sortRows(deals, sort.dir, (deal) => {
    if (sort.key === 'title') return deal.title;
    if (sort.key === 'plan') return planInfo(deal, plans);
    if (sort.key === 'amount') return deal.listPriceVnd == null ? null : Number(deal.listPriceVnd);
    if (sort.key === 'stage') return stageListLabel(deal.stageCode, stages.find((item) => item.id === deal.stageId)?.name ?? deal.stageCode);
    if (sort.key === 'date') return deal.stageCode === 'won' ? deal.wonAt : deal.stageCode === 'lost' ? deal.lostAt : deal.expectedCloseOn;
    if (sort.key === 'owner') return deal.ownerName;
    return deal.createdAt;
  });
  const selectedCount = rows.filter((deal) => pick.has(deal.id)).length;
  return (
    <div className="space-y-3">
      {removeError ? <p className="text-center text-sm text-rose-600">{removeError}</p> : null}
      {rows.length > 0 ? (
        <ColumnPicker columns={DEAL_COLUMNS} shown={columns.shown} onToggle={columns.toggle} onShowAll={columns.showAll} selectedCount={selectedCount} />
      ) : null}
      <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={crmTableClass}>
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className={stickyCheck}>
                    <RowCheck
                      checked={selectedCount === rows.length}
                      mixed={selectedCount > 0 && selectedCount < rows.length}
                      onChange={() => pick.toggleVisible(rows.map((deal) => deal.id))}
                      label="Chọn tất cả cơ hội"
                    />
                  </th>
                  <th className={stickyIndex}>STT</th>
                  {columns.shown('title') ? <SortableTh className="sticky left-[6.25rem] z-20 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]" label="Tên cơ hội" active={sort.key === 'title'} dir={sort.dir} onClick={() => sort.toggle('title')} /> : null}
                  {columns.shown('plan') ? <SortableTh label="Thông tin gói" active={sort.key === 'plan'} dir={sort.dir} onClick={() => sort.toggle('plan')} /> : null}
                  {columns.shown('amount') ? <SortableTh label="Số tiền" active={sort.key === 'amount'} dir={sort.dir} onClick={() => sort.toggle('amount')} /> : null}
                  {columns.shown('stage') ? <SortableTh label="Giai đoạn" active={sort.key === 'stage'} dir={sort.dir} onClick={() => sort.toggle('stage')} /> : null}
                  {columns.shown('date') ? <SortableTh label="Ngày kỳ vọng / kết thúc" active={sort.key === 'date'} dir={sort.dir} onClick={() => sort.toggle('date')} /> : null}
                  {columns.shown('owner') ? <SortableTh label="Người thực hiện" active={sort.key === 'owner'} dir={sort.dir} onClick={() => sort.toggle('owner')} /> : null}
                  {columns.shown('created') ? <SortableTh label="Ngày tạo" active={sort.key === 'created'} dir={sort.dir} onClick={() => sort.toggle('created')} /> : null}
                  <th className={stickyActionsHead} />
                </tr>
              </thead>
              <tbody>
                {rows.map((deal, index) => {
                  const stage = stages.find((item) => item.id === deal.stageId);
                  const picked = pick.has(deal.id);
                  return (
                    <tr key={deal.id} className={`group ${picked ? 'bg-[#f6f4ff]' : ''}`}>
                      <td className={stickyCell(picked, 'check')}><RowCheck checked={picked} onChange={() => pick.toggle(deal.id)} label={`Chọn ${deal.title}`} /></td>
                      <td className={stickyCell(picked, 'index')}>{index + 1}</td>
                      {columns.shown('title') ? <td className={`${crmTd} font-medium text-slate-900 ${stickyCell(picked, 'name')}`}>{deal.title}</td> : null}
                      {columns.shown('plan') ? <td className={`${crmTd} text-slate-600`}>{planInfo(deal, plans)}</td> : null}
                      {columns.shown('amount') ? <td className={`${crmTd} text-slate-700`}>{formatVnd(deal.listPriceVnd)}</td> : null}
                      {columns.shown('stage') ? (
                        <td className={crmTd}>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[deal.stageCode] ?? TONE.new}`}>{stageListLabel(deal.stageCode, stage?.name ?? deal.stageCode)}</span>
                        </td>
                      ) : null}
                      {columns.shown('date') ? <td className={`${crmTd} text-slate-600`}>{expectOrEnd(deal)}</td> : null}
                      {columns.shown('owner') ? <td className={`${crmTd} text-slate-600`}>{deal.ownerName}</td> : null}
                      {columns.shown('created') ? <td className={`${crmTd} text-slate-600`}>{dayText(deal.createdAt)}</td> : null}
                      <td className={stickyCell(picked, 'actions')}>
                        <RowActions open={picked}>
                          {canDeleteOwned(me.data?.role, me.data?.id, deal.ownerUserId) ? (
                            <RowIconButton
                              label="Xóa"
                              tone="delete"
                              onClick={() => {
                                if (!window.confirm(`Xóa cơ hội ${deal.title}? Đơn đã trả của công ty vẫn giữ.`)) return;
                                removeDeal.mutate(deal.id);
                              }}
                            />
                          ) : null}
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <CrmEmpty>{query.trim() ? 'Không có cơ hội khớp.' : 'Chưa có cơ hội.'}</CrmEmpty>
        )}
      </section>
    </div>
  );
}
