'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPlanKind, CrmPlanOption } from '@industriallink/contracts';
import { AlignLeft, FileText, Package, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmDateField, CrmField, CrmFormSection, CrmSelect } from '@/components/crm/fields';
import { errorText, formatVnd, matchesQuery, vietnamDay } from '@/components/crm/format';
import { ColumnPicker, RowCheck, crmTableClass, crmTd, filterChipClass, SortableTh, sortRows, stickyCell, stickyCheck, stickyIndex, useColumnSort, useRowSelection, useVisibleColumns } from '@/components/crm/table';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { fetchMe } from '@/lib/auth';
import { createCrmQuote, fetchCrmPlans, fetchCrmQuotes, fetchCrmTaxSuggestions } from '@/lib/crm';

const QUOTE_COLUMNS = [
  { key: 'code', label: 'Số báo giá' },
  { key: 'quoted', label: 'Ngày báo giá' },
  { key: 'valid', label: 'Hiệu lực đến ngày' },
  { key: 'company', label: 'Khách hàng' },
  { key: 'contact', label: 'Liên hệ' },
  { key: 'price', label: 'Giá niêm yết' },
  { key: 'status', label: 'Tình trạng' },
  { key: 'note', label: 'Mô tả' },
] as const;

type QuoteColumn = (typeof QUOTE_COLUMNS)[number]['key'];

export function CrmQuotesPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['crm-plans'], queryFn: fetchCrmPlans });
  const quotes = useQuery({ queryKey: ['crm-quotes'], queryFn: fetchCrmQuotes });
  const board = useCrmBoard();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [taxQuery, setTaxQuery] = useState('');
  const [taxOpen, setTaxOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [quotedOn, setQuotedOn] = useState(() => vietnamDay(new Date().toISOString()));
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState<'draft' | 'sent'>('draft');
  const [dealId, setDealId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [option1, setOption1] = useState('');
  const [option2, setOption2] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent'>('all');
  const sort = useColumnSort<'code' | 'quoted' | 'valid' | 'company' | 'contact' | 'price' | 'status' | 'note'>('quoted', 'desc');
  const quoteColumns = useVisibleColumns<QuoteColumn>('crm-cols-quotes', QUOTE_COLUMNS.map((column) => column.key));
  const pick = useRowSelection();
  const [error, setError] = useState<string | null>(null);
  const filledTax = useRef('');
  const deals = board.data?.deals ?? [];
  const leads = board.data?.leads ?? [];
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
        address: address || null,
        companyId,
        quotedOn,
        validUntil: validUntil || null,
        status,
        leadId: leadId || null,
        dealId: dealId || null,
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

  useEffect(() => {
    const timer = setTimeout(() => setTaxQuery(taxCode.replace(/\D/g, '')), 300);
    return () => clearTimeout(timer);
  }, [taxCode]);

  const taxSuggestions = useQuery({
    queryKey: ['crm-tax-suggestions', taxQuery],
    queryFn: () => fetchCrmTaxSuggestions(taxQuery),
    enabled: taxQuery.length >= 2,
  });

  useEffect(() => {
    const digits = taxCode.replace(/\D/g, '');
    if (digits !== taxQuery || (taxQuery.length !== 10 && taxQuery.length !== 13)) return;
    if (filledTax.current === taxQuery) return;
    const match = taxSuggestions.data?.find((item) => item.taxCode === taxQuery);
    if (!match) return;
    filledTax.current = taxQuery;
    setCompanyName(match.companyName);
    if (match.address) setAddress(match.address);
    setCompanyId(match.companyId);
  }, [taxCode, taxQuery, taxSuggestions.data]);

  function applyTax(item: { taxCode: string; companyName: string; address: string | null; companyId: string | null }) {
    filledTax.current = item.taxCode;
    setTaxCode(item.taxCode);
    setCompanyName(item.companyName);
    if (item.address) setAddress(item.address);
    setCompanyId(item.companyId);
    setTaxOpen(false);
  }

  const rows = sortRows(
    (quotes.data ?? []).filter((row) => statusFilter === 'all' || row.status === statusFilter).filter((row) =>
      matchesQuery(query, [row.quoteCode, row.companyName, row.contactName, row.taxCode, row.note, row.dealTitle]),
    ),
    sort.dir,
    (row) => {
      if (sort.key === 'code') return row.quoteCode;
      if (sort.key === 'quoted') return row.quotedOn;
      if (sort.key === 'valid') return row.validUntil;
      if (sort.key === 'company') return row.companyName;
      if (sort.key === 'contact') return row.contactName;
      if (sort.key === 'price') return Number(row.option1PriceVnd);
      if (sort.key === 'note') return row.note;
      return row.status === 'sent' ? 'Đã gửi' : 'Bản thảo';
    },
  );

  return (
    <CrmFrame
      kicker="Giá niêm yết chưa VAT"
      title="Bảng chào giá"
      description="Ghi khách, hạn hiệu lực và một hoặc hai gói. Mỗi dòng là một phương án, không cộng hai dòng. Giá lấy từ gói SuperAdmin, chưa VAT. Xuất tờ không tạo đơn và không bật gói."
      placeholder="Tìm số báo giá, khách hàng hoặc người liên hệ"
      search={{ value: query, onChange: setQuery }}
      footnote="Khách vẫn tự thanh toán trên inlink. Tờ này chỉ để gửi."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2">
        <CrmFormSection icon={<FileText className="h-3.5 w-3.5" />}>Thông tin chi tiết</CrmFormSection>
        <CrmField label="Số báo giá">
          <input className={crmFieldClass} value="Tự sinh khi lưu" aria-label="Số báo giá" disabled />
        </CrmField>
        <CrmField label="Ngày báo giá *">
          <CrmDateField value={quotedOn} onChange={setQuotedOn} required />
        </CrmField>
        <CrmField label="Hiệu lực đến ngày">
          <CrmDateField value={validUntil} onChange={setValidUntil} placeholder="Chưa hẹn hạn" />
        </CrmField>
        <CrmField label="Tình trạng">
          <CrmSelect
            value={status}
            placeholder="Tình trạng"
            options={[{ value: 'draft', label: 'Bản thảo' }, { value: 'sent', label: 'Đã gửi' }]}
            onChange={(next) => setStatus(next === 'sent' ? 'sent' : 'draft')}
          />
        </CrmField>
        <div className="relative">
          <CrmField label="Mã số thuế">
          <input
            className={crmFieldClass}
            aria-label="Mã số thuế"
            inputMode="numeric"
            autoComplete="off"
            placeholder="10 hoặc 13 số"
            value={taxCode}
            onFocus={() => setTaxOpen(true)}
            onBlur={() => setTaxOpen(false)}
            onChange={(event) => {
              setTaxCode(event.target.value);
              setCompanyId(null);
            }}
          />
          </CrmField>
          {taxOpen && taxSuggestions.data && taxSuggestions.data.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-[min(100vw-2rem,28rem)] overflow-auto rounded-xl border border-[#e4e0f7] bg-white py-1 shadow-[0_16px_40px_rgba(76,62,201,0.14)]">
              {taxSuggestions.data.map((item) => (
                <li key={`${item.source}-${item.taxCode}-${item.companyId ?? 'registry'}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#efeaff]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTax(item)}
                  >
                    <span className="font-medium text-slate-800">{item.companyName}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">MST {item.taxCode}</span>
                    {item.address ? <span className="mt-0.5 block text-xs text-slate-500">{item.address}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <CrmField label="Tên công ty *">
          <input className={crmFieldClass} aria-label="Tên công ty" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
        </CrmField>
        <CrmField label="Địa chỉ công ty" className="md:col-span-2">
          <input className={crmFieldClass} aria-label="Địa chỉ công ty" value={address} onChange={(event) => setAddress(event.target.value)} />
        </CrmField>
        <CrmField label="Liên hệ *">
          <input className={crmFieldClass} aria-label="Liên hệ" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
        </CrmField>
        <CrmField label="Cơ hội">
        <CrmSelect
          value={dealId}
          placeholder="Cơ hội"
          options={[{ value: '', label: 'Không gắn' }, ...deals.map((deal) => ({ value: deal.id, label: `${deal.title} · ${deal.companyName}` }))]}
          onChange={(next) => {
            setDealId(next);
            const deal = deals.find((item) => item.id === next);
            if (!deal) {
              setLeadId('');
              return;
            }
            setCompanyName(deal.companyName);
            const lead = leads.find((item) => item.id === deal.leadId);
            setLeadId(lead?.id ?? '');
            setCompanyId(lead?.companyId ?? null);
            if (!lead) return;
            setContactName(lead.contactName);
            if (lead.taxCode) setTaxCode(lead.taxCode);
            if (lead.address) setAddress(lead.address);
          }}
        />
        </CrmField>

        <CrmFormSection icon={<Package className="h-3.5 w-3.5" />}>Thông tin gói</CrmFormSection>
        <div className="overflow-x-auto md:col-span-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-2">STT</th>
                <th className="px-2 py-2">Gói</th>
                <th className="px-2 py-2">Diễn giải</th>
                <th className="px-2 py-2">Đơn vị</th>
                <th className="px-2 py-2">Số lượng</th>
                <th className="px-2 py-2">Đơn giá</th>
                <th className="px-2 py-2">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <QuoteLine index={1} value={option1} plans={plans.data ?? []} options={options} required loading={plans.isLoading} onChange={setOption1} />
              <QuoteLine index={2} value={option2} plans={plans.data ?? []} options={[{ value: '', label: 'Không chọn phương án 2' }, ...options]} onChange={setOption2} />
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">Hai dòng là hai phương án để khách chọn một. Không cộng hai thành tiền. Giá chưa VAT, không chiết khấu.</p>
        </div>

        <CrmFormSection icon={<AlignLeft className="h-3.5 w-3.5" />}>Thông tin mô tả</CrmFormSection>
        <CrmField label="Mô tả" className="md:col-span-2">
          <textarea className={`${crmFieldClass} min-h-24`} aria-label="Mô tả" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
        </CrmField>

        <CrmFormSection icon={<UserRound className="h-3.5 w-3.5" />}>Thông tin hệ thống</CrmFormSection>
        <CrmField label="Người thực hiện">
          <input className={crmFieldClass} aria-label="Người thực hiện" value={me.data?.displayName ?? 'Đang tải…'} disabled />
        </CrmField>

        <button type="submit" className={`${crmButtonClass} md:col-span-2`} disabled={save.isPending || !option1 || !quotedOn}>
          {save.isPending ? 'Đang lập…' : 'Lưu và thêm'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {quotes.isLoading ? <CrmEmpty>Đang tải báo giá…</CrmEmpty> : null}
      {quotes.isError ? <CrmEmpty>Không tải được danh sách báo giá.</CrmEmpty> : null}
      {quotes.data && quotes.data.length === 0 ? <CrmEmpty>Chưa có báo giá.</CrmEmpty> : null}
      {quotes.data && quotes.data.length > 0 && rows.length === 0 ? <CrmEmpty>Không có báo giá khớp.</CrmEmpty> : null}
      {quotes.data && quotes.data.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {([['all', 'Tất cả'], ['draft', 'Bản thảo'], ['sent', 'Đã gửi']] as const).map(([id, label]) => (
            <button key={id} type="button" className={filterChipClass(statusFilter === id)} onClick={() => setStatusFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <>
          <ColumnPicker
            columns={QUOTE_COLUMNS}
            shown={quoteColumns.shown}
            onToggle={quoteColumns.toggle}
            onShowAll={quoteColumns.showAll}
            selectedCount={rows.filter((row) => pick.has(row.id)).length}
          />
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="overflow-x-auto">
              <table className={crmTableClass}>
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className={stickyCheck}>
                      <RowCheck
                        checked={rows.every((row) => pick.has(row.id))}
                        mixed={rows.some((row) => pick.has(row.id)) && !rows.every((row) => pick.has(row.id))}
                        onChange={() => pick.toggleVisible(rows.map((row) => row.id))}
                        label="Chọn tất cả báo giá"
                      />
                    </th>
                    <th className={stickyIndex}>STT</th>
                    {quoteColumns.shown('code') ? <SortableTh className="sticky left-[6.25rem] z-20 bg-slate-50 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]" label="Số báo giá" active={sort.key === 'code'} dir={sort.dir} onClick={() => sort.toggle('code')} /> : null}
                    {quoteColumns.shown('quoted') ? <SortableTh label="Ngày báo giá" active={sort.key === 'quoted'} dir={sort.dir} onClick={() => sort.toggle('quoted')} /> : null}
                    {quoteColumns.shown('valid') ? <SortableTh label="Hiệu lực đến ngày" active={sort.key === 'valid'} dir={sort.dir} onClick={() => sort.toggle('valid')} /> : null}
                    {quoteColumns.shown('company') ? <SortableTh label="Khách hàng" active={sort.key === 'company'} dir={sort.dir} onClick={() => sort.toggle('company')} /> : null}
                    {quoteColumns.shown('contact') ? <SortableTh label="Liên hệ" active={sort.key === 'contact'} dir={sort.dir} onClick={() => sort.toggle('contact')} /> : null}
                    {quoteColumns.shown('price') ? <SortableTh label="Giá niêm yết" active={sort.key === 'price'} dir={sort.dir} onClick={() => sort.toggle('price')} /> : null}
                    {quoteColumns.shown('status') ? <SortableTh label="Tình trạng" active={sort.key === 'status'} dir={sort.dir} onClick={() => sort.toggle('status')} /> : null}
                    {quoteColumns.shown('note') ? <SortableTh label="Mô tả" active={sort.key === 'note'} dir={sort.dir} onClick={() => sort.toggle('note')} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const picked = pick.has(row.id);
                    return (
                      <tr key={row.id} className={`border-t border-slate-100 ${picked ? 'bg-[#f6f4ff]' : ''}`}>
                        <td className={stickyCell(picked, 'check')}><RowCheck checked={picked} onChange={() => pick.toggle(row.id)} label={`Chọn ${row.quoteCode}`} /></td>
                        <td className={stickyCell(picked, 'index')}>{index + 1}</td>
                        {quoteColumns.shown('code') ? <td className={`${crmTd} ${stickyCell(picked, 'name')}`}><Link href={`/crm/quotes/${row.id}`} className="font-semibold text-[#4c3ec9]">{row.quoteCode}</Link></td> : null}
                        {quoteColumns.shown('quoted') ? <td className={`${crmTd} text-slate-600`}>{showDay(row.quotedOn)}</td> : null}
                        {quoteColumns.shown('valid') ? <td className={`${crmTd} text-slate-600`}>{showDay(row.validUntil)}</td> : null}
                        {quoteColumns.shown('company') ? <td className={`${crmTd} font-medium text-slate-800`}>{row.companyName}</td> : null}
                        {quoteColumns.shown('contact') ? <td className={`${crmTd} text-slate-600`}>{row.contactName}</td> : null}
                        {quoteColumns.shown('price') ? (
                          <td className={`${crmTd} text-slate-700`}>
                            {row.option2PriceVnd ? `Phương án 1 · ${formatVnd(row.option1PriceVnd)} · Phương án 2 · ${formatVnd(row.option2PriceVnd)}` : formatVnd(row.option1PriceVnd)}
                          </td>
                        ) : null}
                        {quoteColumns.shown('status') ? (
                          <td className={crmTd}>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'sent' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{row.status === 'sent' ? 'Đã gửi' : 'Bản thảo'}</span>
                          </td>
                        ) : null}
                        {quoteColumns.shown('note') ? <td className={`${crmTd} text-slate-500`}>{row.note ?? '—'}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </CrmFrame>
  );
}

function QuoteLine({
  index,
  value,
  plans,
  options,
  required = false,
  loading = false,
  onChange,
}: {
  index: number;
  value: string;
  plans: CrmPlanOption[];
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
}) {
  const plan = plans.find((item) => planKey(item) === value);
  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-2 text-slate-500">{index}</td>
      <td className="px-2 py-2">
        <CrmSelect value={value} required={required} placeholder={loading ? 'Đang tải gói…' : `Phương án ${index}`} options={options} onChange={onChange} />
      </td>
      <td className="px-2 py-2 text-slate-700">{plan ? plan.name : '—'}</td>
      <td className="px-2 py-2 text-slate-500">Gói</td>
      <td className="px-2 py-2 text-slate-500">{plan ? 1 : '—'}</td>
      <td className="px-2 py-2 text-slate-700">{plan ? formatVnd(plan.priceVnd) : '—'}</td>
      <td className="px-2 py-2 font-medium text-slate-800">{plan ? formatVnd(plan.priceVnd) : '—'}</td>
    </tr>
  );
}

function showDay(value: string | null): string {
  if (!value) return '—';
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}

function planKey(plan: CrmPlanOption): string {
  return `${plan.kind}:${plan.code}`;
}

function splitPlan(value: string): { kind: CrmPlanKind; code: string } | null {
  const [kind, code] = value.split(':');
  if ((kind !== 'platform' && kind !== 'sourcing') || !code) return null;
  return { kind, code };
}
