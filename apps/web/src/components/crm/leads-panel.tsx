'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDot, Plus } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  CrmChip,
  CrmEmpty,
  CrmFrame,
  crmActionClass,
  crmButtonClass,
} from '@/components/crm-frame';
import { CrmDateField, CrmField, CrmSelect } from '@/components/crm/fields';
import { contactPhoneLabel, errorText, isFresh, leadSourceLabel, leadStatusLabel, matchesQuery, vietnamDay } from '@/components/crm/format';
import { ColumnPicker, RowCheck, crmTableClass, crmTd, SortableTh, sortRows, stickyCell, stickyCheck, stickyIndex, useColumnSort, useRowSelection, useVisibleColumns } from '@/components/crm/table';
import { blankLeadDraft, draftFromLead, LeadFormFields, type LeadDraft } from '@/components/crm/lead-form-fields';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { fetchMe } from '@/lib/auth';
import { createCrmLead, fetchCrmCompanies, fetchCrmMarketing, fetchCrmOwners, fetchCrmPartners, fetchCrmTaxSuggestions, updateCrmLead } from '@/lib/crm';

type StatusFilter = 'all' | 'open' | 'converted';
type SourceFilter = 'all' | 'web' | 'zalo' | 'event' | 'partner' | 'unknown';

const SOURCES: Array<Exclude<SourceFilter, 'all' | 'unknown'>> = ['web', 'zalo', 'event', 'partner'];

const LEAD_COLUMNS = [
  { key: 'company', label: 'Công ty' },
  { key: 'tax', label: 'Mã số thuế' },
  { key: 'contact', label: 'Liên hệ' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'source', label: 'Nguồn' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'owner', label: 'Phụ trách' },
  { key: 'created', label: 'Ngày tạo' },
] as const;

type LeadColumn = (typeof LEAD_COLUMNS)[number]['key'];

export function CrmLeadsPanel() {
  const board = useCrmBoard();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [draft, setDraft] = useState<LeadDraft>(blankLeadDraft);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [taxQuery, setTaxQuery] = useState('');
  const [taxTarget, setTaxTarget] = useState<'create' | 'edit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<LeadDraft>(blankLeadDraft);
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');

  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const canReassign = me.data?.role === 'super_admin';
  const owners = useQuery({ queryKey: ['crm-owners'], queryFn: fetchCrmOwners, enabled: canReassign });

  const partners = useQuery({
    queryKey: ['crm-partners'],
    queryFn: fetchCrmPartners,
  });
  const campaigns = useQuery({ queryKey: ['crm-marketing'], queryFn: fetchCrmMarketing });
  const campaignOptions = (campaigns.data?.campaigns ?? [])
    .filter((row) => row.status !== 'cancelled')
    .map((row) => ({ value: row.id, label: `${row.name} · ${row.campaignCode}` }));

  const activeDraft = taxTarget === 'edit' ? edit : draft;
  useEffect(() => {
    const timer = setTimeout(() => setTaxQuery(activeDraft.taxCode.replace(/\D/g, '')), 300);
    return () => clearTimeout(timer);
  }, [activeDraft.taxCode]);

  const companies = useQuery({
    queryKey: ['crm-companies', activeDraft.companyName],
    queryFn: () => fetchCrmCompanies(activeDraft.companyName),
    enabled: activeDraft.companyName.trim().length >= 2 && (taxTarget === 'edit' || !companyId),
  });

  const taxSuggestions = useQuery({
    queryKey: ['crm-tax-suggestions', taxQuery],
    queryFn: () => fetchCrmTaxSuggestions(taxQuery),
    enabled: taxTarget !== null && taxQuery.length >= 2,
  });

  function leadBody(value: LeadDraft, linkedCompanyId: string | null) {
    if (value.source !== 'web' && value.source !== 'zalo' && value.source !== 'event' && value.source !== 'partner') {
      return Promise.reject(new Error('Chọn nguồn khách'));
    }
    const source: 'web' | 'zalo' | 'event' | 'partner' = value.source;
    if (value.source === 'partner' && !value.partnerId) {
      return Promise.reject(new Error('Chọn cộng tác viên'));
    }
    return {
      companyName: value.companyName,
      contactName: value.contactName,
      contactPhone: value.contactPhone || null,
      taxCode: value.taxCode || null,
      address: value.address || null,
      contactEmail: value.contactEmail || null,
      zalo: value.zalo || null,
      jobTitle: value.jobTitle || null,
      department: value.department || null,
      industry: value.industry || null,
      bankAccount: value.bankAccount || null,
      bankName: value.bankName || null,
      foundedOn: value.foundedOn || null,
      orgType: value.orgType || null,
      orgField: value.orgField || null,
      revenueBand: value.revenueBand || null,
      country: 'Việt Nam',
      province: value.province || null,
      ward: value.ward || null,
      street: value.street || null,
      areaCode: value.areaCode || null,
      companyId: linkedCompanyId,
      source,
      partnerId: value.source === 'partner' ? value.partnerId : null,
      campaignId: value.campaignId || null,
    };
  }

  const addLead = useMutation({
    mutationFn: () => {
      const body = leadBody(draft, companyId);
      if (body instanceof Promise) return body;
      return createCrmLead(body);
    },
    onSuccess: () => {
      setDraft(blankLeadDraft());
      setCompanyId(null);
      setTaxTarget(null);
      setCreating(false);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được lead')),
  });

  const saveLead = useMutation({
    mutationFn: (leadId: string) => {
      const body = leadBody(edit, null);
      if (body instanceof Promise) return body;
      const { companyId: _linked, ...fields } = body;
      return updateCrmLead(leadId, {
        ...fields,
        ownerUserId: canReassign ? editOwnerId : undefined,
        nextFollowUpAt: editFollowUp || null,
      });
    },
    onSuccess: () => {
      setEditingId(null);
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-follow-ups'] });
    },
    onError: (err) => setError(errorText(err, 'Không sửa được lead')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    addLead.mutate();
  }

  const sort = useColumnSort<'company' | 'tax' | 'contact' | 'phone' | 'source' | 'status' | 'owner' | 'created'>('created', 'desc');
  const leads = sortRows(
    (board.data?.leads ?? []).filter((lead) => {
    if (filter === 'open' && lead.status !== 'open') return false;
    if (filter === 'converted' && lead.status !== 'converted') return false;
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
    return matchesQuery(query, [
      lead.companyName,
      lead.contactName,
      lead.contactPhone,
      lead.contactEmail,
      lead.zalo,
      lead.province,
      lead.taxCode,
      lead.leadCode,
      leadSourceLabel(lead.source),
      lead.partnerName,
      lead.partnerCode,
    ]);
  }),
    sort.dir,
    (lead) => {
      if (sort.key === 'company') return lead.companyName;
      if (sort.key === 'tax') return lead.taxCode;
      if (sort.key === 'contact') return lead.contactName;
      if (sort.key === 'phone') return lead.contactPhone;
      if (sort.key === 'source') return leadSourceLabel(lead.source);
      if (sort.key === 'status') return leadStatusLabel(lead.status);
      if (sort.key === 'owner') return lead.ownerName;
      return lead.createdAt;
    },
  );
  const columns = useVisibleColumns<LeadColumn>('crm-cols-leads', LEAD_COLUMNS.map((column) => column.key));
  const pick = useRowSelection();
  const all = board.data?.leads ?? [];
  const editingLead = all.find((lead) => lead.id === editingId) ?? null;

  return (
    <CrmFrame
      kicker="Nhà máy và người phụ trách HR"
      title="Tiềm năng chưa phải khách đã mua gói"
      description="Bắt buộc mã số thuế, tên công ty, người liên hệ và nguồn khách. Số điện thoại, email, Zalo, chức danh, tổ chức và địa chỉ để trống được. Gõ mã số thuế để gợi ý tên và địa chỉ."
      placeholder="Tìm tên công ty, mã số thuế hoặc số điện thoại"
      search={{ value: query, onChange: setQuery }}
      footnote="CRM không gán gói và không cộng Credit."
      chips={
        <>
          <CrmChip active={filter === 'all'} onClick={() => setFilter('all')} icon={<CircleDot className="h-4 w-4" />} label={`Tất cả · ${all.length}`} />
          <CrmChip active={filter === 'open'} onClick={() => setFilter('open')} icon={<CircleDot className="h-4 w-4" />} label={`Đang mở · ${all.filter((lead) => lead.status === 'open').length}`} />
          <CrmChip active={filter === 'converted'} onClick={() => setFilter('converted')} icon={<CircleDot className="h-4 w-4" />} label={`Đã có deal · ${all.filter((lead) => lead.status === 'converted').length}`} />
          {SOURCES.map((item) => (
            <CrmChip
              key={item}
              active={sourceFilter === item}
              onClick={() => setSourceFilter(sourceFilter === item ? 'all' : item)}
              icon={<CircleDot className="h-4 w-4" />}
              label={`${leadSourceLabel(item)} · ${all.filter((lead) => lead.source === item).length}`}
            />
          ))}
          {all.some((lead) => lead.source === 'unknown') ? (
            <CrmChip
              active={sourceFilter === 'unknown'}
              onClick={() => setSourceFilter(sourceFilter === 'unknown' ? 'all' : 'unknown')}
              icon={<CircleDot className="h-4 w-4" />}
              label={`Chưa rõ · ${all.filter((lead) => lead.source === 'unknown').length}`}
            />
          ) : null}
        </>
      }
    >
      <div className="flex justify-end">
        <button
          type="button"
          className={`${crmButtonClass} inline-flex items-center gap-1.5`}
          onClick={() => {
            setCreating((open) => !open);
            setEditingId(null);
            setTaxTarget(null);
          }}
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Đóng' : 'Tạo'}
        </button>
      </div>
      {creating ? (
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2">
        <LeadFormFields
          draft={draft}
          onChange={(next) => {
            if (next.companyName !== draft.companyName || next.taxCode !== draft.taxCode) setCompanyId(null);
            if (next.taxCode !== draft.taxCode || next.companyName !== draft.companyName) setTaxTarget('create');
            setDraft(next);
          }}
          campaignOptions={campaignOptions}
          partners={partners.data ?? []}
          partnersLoading={partners.isLoading}
          taxOpen={taxTarget === 'create'}
          onTaxFocus={() => setTaxTarget('create')}
          onTaxBlur={() => setTaxTarget((current) => (current === 'create' ? null : current))}
          suggestions={taxTarget === 'create' ? taxSuggestions.data : undefined}
          onPickTax={(item) => {
            setCompanyId(item.companyId);
            setDraft((current) => ({
              ...current,
              taxCode: item.taxCode,
              companyName: item.companyName,
              address: item.address ?? current.address,
            }));
            setTaxTarget(null);
          }}
          companies={taxTarget === 'create' ? companies.data : undefined}
          onPickCompany={(company) => {
            setCompanyId(company.id);
            setDraft((current) => ({
              ...current,
              companyName: company.name,
              taxCode: company.taxCode ?? current.taxCode,
              address: company.address ?? current.address,
            }));
          }}
          extra={
            <button type="submit" className={`${crmButtonClass} md:col-span-2`} disabled={addLead.isPending || !draft.source || (draft.source === 'partner' && !draft.partnerId)}>
              {addLead.isPending ? 'Đang lưu…' : 'Thêm lead'}
            </button>
          }
        />
      </form>
      ) : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải lead…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được danh sách lead.</CrmEmpty> : null}
      {board.data && all.length === 0 ? <CrmEmpty>Chưa có lead.</CrmEmpty> : null}
      {board.data && all.length > 0 && leads.length === 0 ? <CrmEmpty>Không có lead khớp bộ lọc.</CrmEmpty> : null}
      {editingLead ? (
        <form onSubmit={(event) => { event.preventDefault(); saveLead.mutate(editingLead.id); }} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2">
          <LeadFormFields
            draft={edit}
            onChange={(next) => {
              if (next.taxCode !== edit.taxCode || next.companyName !== edit.companyName) setTaxTarget('edit');
              setEdit(next);
            }}
            campaignOptions={
              campaignOptions.some((item) => item.value === edit.campaignId) || !edit.campaignId
                ? campaignOptions
                : [...campaignOptions, { value: edit.campaignId, label: editingLead.campaignName ?? 'Chiến dịch đã gắn' }]
            }
            partners={partners.data ?? []}
            partnersLoading={partners.isLoading}
            taxOpen={taxTarget === 'edit'}
            onTaxFocus={() => setTaxTarget('edit')}
            onTaxBlur={() => setTaxTarget((current) => (current === 'edit' ? null : current))}
            suggestions={taxTarget === 'edit' ? taxSuggestions.data : undefined}
            onPickTax={(item) => {
              setEdit((current) => ({
                ...current,
                taxCode: item.taxCode,
                companyName: item.companyName,
                address: item.address ?? current.address,
              }));
              setTaxTarget(null);
            }}
            companies={taxTarget === 'edit' ? companies.data : undefined}
            onPickCompany={(company) => {
              setEdit((current) => ({
                ...current,
                companyName: company.name,
                taxCode: company.taxCode ?? current.taxCode,
                address: company.address ?? current.address,
              }));
            }}
            extra={
              <>
                {canReassign ? (
                  <CrmField label="Người phụ trách">
                    <CrmSelect
                      value={editOwnerId}
                      placeholder="Người phụ trách"
                      options={(owners.data ?? []).map((owner) => ({ value: owner.id, label: owner.name }))}
                      onChange={setEditOwnerId}
                    />
                  </CrmField>
                ) : null}
                <CrmField label="Ngày hẹn gọi lại">
                  <CrmDateField value={editFollowUp} onChange={setEditFollowUp} />
                </CrmField>
                <div className="flex gap-2 md:col-span-2">
                  <button type="submit" className={crmButtonClass} disabled={saveLead.isPending}>
                    {saveLead.isPending ? 'Đang lưu…' : 'Lưu lead'}
                  </button>
                  <button type="button" className={crmActionClass} onClick={() => setEditingId(null)}>Đóng</button>
                </div>
              </>
            }
          />
        </form>
      ) : null}
      {leads.length > 0 ? (
        <>
          <ColumnPicker
            columns={LEAD_COLUMNS}
            shown={columns.shown}
            onToggle={columns.toggle}
            onShowAll={columns.showAll}
            selectedCount={leads.filter((lead) => pick.has(lead.id)).length}
          />
          <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
            <div className="overflow-x-auto">
              <table className={crmTableClass}>
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className={stickyCheck}>
                      <RowCheck
                        checked={leads.length > 0 && leads.every((lead) => pick.has(lead.id))}
                        mixed={leads.some((lead) => pick.has(lead.id)) && !leads.every((lead) => pick.has(lead.id))}
                        onChange={() => pick.toggleVisible(leads.map((lead) => lead.id))}
                        label="Chọn tất cả tiềm năng"
                      />
                    </th>
                    <th className={stickyIndex}>STT</th>
                    {columns.shown('company') ? <SortableTh className="sticky left-[6.25rem] z-20 bg-slate-50 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]" label="Công ty" active={sort.key === 'company'} dir={sort.dir} onClick={() => sort.toggle('company')} /> : null}
                    {columns.shown('tax') ? <SortableTh label="Mã số thuế" active={sort.key === 'tax'} dir={sort.dir} onClick={() => sort.toggle('tax')} /> : null}
                    {columns.shown('contact') ? <SortableTh label="Liên hệ" active={sort.key === 'contact'} dir={sort.dir} onClick={() => sort.toggle('contact')} /> : null}
                    {columns.shown('phone') ? <SortableTh label="Điện thoại" active={sort.key === 'phone'} dir={sort.dir} onClick={() => sort.toggle('phone')} /> : null}
                    {columns.shown('source') ? <SortableTh label="Nguồn" active={sort.key === 'source'} dir={sort.dir} onClick={() => sort.toggle('source')} /> : null}
                    {columns.shown('status') ? <SortableTh label="Trạng thái" active={sort.key === 'status'} dir={sort.dir} onClick={() => sort.toggle('status')} /> : null}
                    {columns.shown('owner') ? <SortableTh label="Phụ trách" active={sort.key === 'owner'} dir={sort.dir} onClick={() => sort.toggle('owner')} /> : null}
                    {columns.shown('created') ? <SortableTh label="Ngày tạo" active={sort.key === 'created'} dir={sort.dir} onClick={() => sort.toggle('created')} /> : null}
                    <th className="whitespace-nowrap px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => {
                    const picked = pick.has(lead.id);
                    return (
                      <tr key={lead.id} className={`border-t border-slate-100 ${picked ? 'bg-[#f6f4ff]' : ''}`}>
                        <td className={stickyCell(picked, 'check')}><RowCheck checked={picked} onChange={() => pick.toggle(lead.id)} label={`Chọn ${lead.companyName}`} /></td>
                        <td className={stickyCell(picked, 'index')}>{index + 1}</td>
                        {columns.shown('company') ? (
                          <td className={`${crmTd} font-medium text-slate-900 ${stickyCell(picked, 'name')}`}>
                            {lead.companyName}
                            <span className="ml-2 text-xs font-normal text-slate-400">{lead.leadCode}</span>
                            {isFresh(lead.createdAt) ? <span className="ml-2 rounded-full bg-[#ff4d4f] px-1.5 py-0.5 text-[10px] font-bold text-white">Mới</span> : null}
                          </td>
                        ) : null}
                        {columns.shown('tax') ? <td className={`${crmTd} text-slate-600`}>{lead.taxCode ?? '—'}</td> : null}
                        {columns.shown('contact') ? <td className={`${crmTd} text-slate-700`}>{lead.contactName}</td> : null}
                        {columns.shown('phone') ? <td className={`${crmTd} text-slate-600`}>{contactPhoneLabel(lead.contactPhone)}</td> : null}
                        {columns.shown('source') ? <td className={`${crmTd} text-slate-600`}>{lead.partnerName ? lead.partnerName : leadSourceLabel(lead.source)}</td> : null}
                        {columns.shown('status') ? (
                          <td className={crmTd}>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lead.status === 'converted' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{leadStatusLabel(lead.status)}</span>
                          </td>
                        ) : null}
                        {columns.shown('owner') ? <td className={`${crmTd} text-slate-600`}>{lead.ownerName}</td> : null}
                        {columns.shown('created') ? <td className={`${crmTd} text-slate-600`}>{vietnamDay(lead.createdAt).split('-').reverse().join('/')}</td> : null}
                        <td className={crmTd}>
                          <div className="flex justify-end gap-2">
                            {lead.companyId ? <Link href={`/crm/companies/${lead.companyId}`} className={`${crmActionClass} !whitespace-nowrap`}>Hồ sơ</Link> : null}
                            <button
                              type="button"
                              className={`${crmActionClass} !whitespace-nowrap`}
                              onClick={() => {
                                setCreating(false);
                                setEditingId(lead.id);
                                setEdit(draftFromLead(lead));
                                setEditOwnerId(lead.ownerUserId);
                                setEditFollowUp(lead.nextFollowUpAt ? vietnamDay(lead.nextFollowUpAt) : '');
                                setTaxTarget(null);
                              }}
                            >
                              Sửa
                            </button>
                          </div>
                        </td>
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
