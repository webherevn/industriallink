'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleDot } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  CrmCard,
  CrmCardGrid,
  CrmChip,
  CrmEmpty,
  CrmFrame,
  crmActionClass,
  crmButtonClass,
  crmFieldClass,
} from '@/components/crm-frame';
import { CrmSelect } from '@/components/crm/fields';
import { contactPhoneLabel, errorText, followUpLabel, isFresh, leadSourceLabel, leadStatusLabel, matchesQuery, vietnamDay } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { fetchMe } from '@/lib/auth';
import { createCrmLead, fetchCrmCompanies, fetchCrmOwners, fetchCrmPartners, fetchCrmTaxSuggestions, updateCrmLead } from '@/lib/crm';

type StatusFilter = 'all' | 'open' | 'converted';
type SourceFilter = 'all' | 'web' | 'zalo' | 'event' | 'partner' | 'unknown';

const SOURCES: Array<Exclude<SourceFilter, 'all' | 'unknown'>> = ['web', 'zalo', 'event', 'partner'];

export function CrmLeadsPanel() {
  const board = useCrmBoard();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [source, setSource] = useState<Exclude<SourceFilter, 'all' | 'unknown'> | ''>('');
  const [partnerId, setPartnerId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [taxQuery, setTaxQuery] = useState('');
  const [taxOpen, setTaxOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<Exclude<SourceFilter, 'all' | 'unknown'> | ''>('');
  const [editPartnerId, setEditPartnerId] = useState('');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editFollowUp, setEditFollowUp] = useState('');

  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const canReassign = me.data?.role === 'super_admin';
  const owners = useQuery({ queryKey: ['crm-owners'], queryFn: fetchCrmOwners, enabled: canReassign });

  const partners = useQuery({
    queryKey: ['crm-partners'],
    queryFn: fetchCrmPartners,
  });

  useEffect(() => {
    const timer = setTimeout(() => setTaxQuery(taxCode.replace(/\D/g, '')), 300);
    return () => clearTimeout(timer);
  }, [taxCode]);

  const companies = useQuery({
    queryKey: ['crm-companies', companyName],
    queryFn: () => fetchCrmCompanies(companyName),
    enabled: companyName.trim().length >= 2 && !companyId,
  });

  const taxSuggestions = useQuery({
    queryKey: ['crm-tax-suggestions', taxQuery],
    queryFn: () => fetchCrmTaxSuggestions(taxQuery),
    enabled: taxOpen && taxQuery.length >= 2,
  });

  const addLead = useMutation({
    mutationFn: () => {
      if (source !== 'web' && source !== 'zalo' && source !== 'event' && source !== 'partner') {
        return Promise.reject(new Error('Chọn nguồn khách'));
      }
      if (source === 'partner' && !partnerId) {
        return Promise.reject(new Error('Chọn cộng tác viên'));
      }
      return createCrmLead({
        companyName,
        contactName,
        contactPhone,
        taxCode: taxCode || null,
        address: address || null,
        companyId,
        source,
        partnerId: source === 'partner' ? partnerId : null,
      });
    },
    onSuccess: () => {
      setCompanyName('');
      setCompanyId(null);
      setContactName('');
      setContactPhone('');
      setTaxCode('');
      setAddress('');
      setTaxOpen(false);
      setSource('');
      setPartnerId('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được lead')),
  });

  const saveLead = useMutation({
    mutationFn: (leadId: string) => {
      const lead = (board.data?.leads ?? []).find((item) => item.id === leadId);
      if (!lead) return Promise.reject(new Error('Không tìm thấy lead'));
      if (editSource !== 'web' && editSource !== 'zalo' && editSource !== 'event' && editSource !== 'partner') {
        return Promise.reject(new Error('Chọn nguồn khách'));
      }
      const form = document.getElementById(`lead-edit-${leadId}`) as HTMLFormElement | null;
      const data = form ? new FormData(form) : null;
      return updateCrmLead(leadId, {
        companyName: String(data?.get('companyName') ?? ''),
        contactName: String(data?.get('contactName') ?? ''),
        contactPhone: String(data?.get('contactPhone') ?? ''),
        taxCode: String(data?.get('taxCode') ?? '') || null,
        address: String(data?.get('address') ?? '') || null,
        contactEmail: lead.contactEmail,
        industry: lead.industry,
        source: editSource,
        partnerId: editSource === 'partner' ? editPartnerId : null,
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

  const leads = (board.data?.leads ?? []).filter((lead) => {
    if (filter === 'open' && lead.status !== 'open') return false;
    if (filter === 'converted' && lead.status !== 'converted') return false;
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
    return matchesQuery(query, [
      lead.companyName,
      lead.contactName,
      lead.contactPhone,
      lead.taxCode,
      lead.leadCode,
      leadSourceLabel(lead.source),
      lead.partnerName,
      lead.partnerCode,
    ]);
  });
  const all = board.data?.leads ?? [];

  return (
    <CrmFrame
      kicker="Nhà máy và người phụ trách HR"
      title="Lead chưa phải khách đã mua gói"
      description="Nhập mã số thuế trước để gợi ý tên công ty. Công ty đã có trên inlink hiện trước. Chưa có thì lấy tên và địa chỉ từ sổ thuế. Người liên hệ và số điện thoại vẫn nhập tay. Không tự tạo lead."
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
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2 xl:grid-cols-6">
        <div className="relative md:col-span-1">
          <input
            className={crmFieldClass}
            placeholder="Mã số thuế"
            inputMode="numeric"
            autoComplete="off"
            value={taxCode}
            onFocus={() => setTaxOpen(true)}
            onBlur={() => setTaxOpen(false)}
            onChange={(event) => {
              setTaxCode(event.target.value);
              setTaxOpen(true);
              setCompanyId(null);
              setAddress('');
            }}
          />
          {taxOpen && taxSuggestions.data && taxSuggestions.data.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-[min(100vw-2rem,28rem)] overflow-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
              {taxSuggestions.data.map((item) => (
                <li key={`${item.source}-${item.taxCode}-${item.companyId ?? 'registry'}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#efeaff]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setTaxCode(item.taxCode);
                      setCompanyName(item.companyName);
                      setCompanyId(item.companyId);
                      setAddress(item.address ?? '');
                      setTaxOpen(false);
                    }}
                  >
                    <span className="font-medium text-slate-800">{item.companyName}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      MST {item.taxCode} · {item.source === 'inlink' ? 'Trên inlink' : 'Sổ thuế'}
                    </span>
                    {item.address ? <span className="mt-0.5 block text-xs text-slate-500">{item.address}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative md:col-span-1">
          <input
            className={crmFieldClass}
            placeholder="Tên công ty"
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value);
              setCompanyId(null);
            }}
            required
          />
          {companies.data && companies.data.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
              {companies.data.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[#efeaff]"
                    onClick={() => {
                      setCompanyId(company.id);
                      setCompanyName(company.name);
                      if (company.taxCode) setTaxCode(company.taxCode);
                      if (company.address) setAddress(company.address);
                    }}
                  >
                    <span className="font-medium text-slate-800">{company.name}</span>
                    {company.taxCode ? <span className="mt-0.5 block text-xs text-slate-400">MST {company.taxCode}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <input className={crmFieldClass} placeholder="Người liên hệ" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Số điện thoại" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required />
        <input className={`${crmFieldClass} md:col-span-2 xl:col-span-6`} placeholder="Địa chỉ" value={address} onChange={(event) => setAddress(event.target.value)} />
        <CrmSelect
          value={source}
          required
          placeholder="Nguồn khách"
          options={SOURCES.map((item) => ({ value: item, label: leadSourceLabel(item) }))}
          onChange={(next) => {
            setSource(next as Exclude<SourceFilter, 'all' | 'unknown'>);
            if (next !== 'partner') setPartnerId('');
          }}
        />
        {source === 'partner' ? (
          <CrmSelect
            value={partnerId}
            required
            placeholder={partners.isLoading ? 'Đang tải cộng tác viên…' : 'Chọn cộng tác viên'}
            options={(partners.data ?? []).map((partner) => ({ value: partner.id, label: `${partner.name} · ${partner.code}` }))}
            onChange={setPartnerId}
          />
        ) : null}
        <button type="submit" className={crmButtonClass} disabled={addLead.isPending || !source || (source === 'partner' && !partnerId)}>
          {addLead.isPending ? 'Đang lưu…' : 'Thêm lead'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải lead…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được danh sách lead.</CrmEmpty> : null}
      {board.data && all.length === 0 ? <CrmEmpty>Chưa có lead.</CrmEmpty> : null}
      {board.data && all.length > 0 && leads.length === 0 ? <CrmEmpty>Không có lead khớp bộ lọc.</CrmEmpty> : null}
      {leads.length > 0 ? (
        <CrmCardGrid columns={3}>
          {leads.map((lead) => (
            <CrmCard
              key={lead.id}
              tone={lead.status === 'converted' ? 'green' : 'sky'}
              badge={isFresh(lead.createdAt) ? 'Mới' : undefined}
              icon={<Building2 className="h-5 w-5" />}
              title={lead.companyName}
              text={`${lead.contactName} · ${contactPhoneLabel(lead.contactPhone)}${lead.taxCode ? ` · MST ${lead.taxCode}` : ''}${lead.address ? ` · ${lead.address}` : ''}. ${leadStatusLabel(lead.status)}.`}
              meta={`${lead.leadCode} · ${lead.partnerName ? `${lead.partnerName} (${lead.partnerCode})` : leadSourceLabel(lead.source)} · ${lead.ownerName}${lead.nextFollowUpAt ? ` · ${followUpLabel(lead.nextFollowUpAt)}` : ''}`}
            >
              <div className="mt-4 flex flex-wrap gap-2">
                {lead.companyId ? (
                  <Link href={`/crm/companies/${lead.companyId}`} className={crmActionClass}>Hồ sơ công ty</Link>
                ) : null}
                <button
                  type="button"
                  className={crmActionClass}
                  onClick={() => {
                    setEditingId(lead.id);
                    setEditSource(lead.source === 'unknown' ? '' : lead.source);
                    setEditPartnerId(lead.partnerId ?? '');
                    setEditOwnerId(lead.ownerUserId);
                    setEditFollowUp(lead.nextFollowUpAt ? vietnamDay(lead.nextFollowUpAt) : '');
                  }}
                >
                  Sửa
                </button>
              </div>
              {editingId === lead.id ? (
                <form id={`lead-edit-${lead.id}`} onSubmit={(event) => { event.preventDefault(); saveLead.mutate(lead.id); }} className="mt-3 grid gap-2">
                  <input className={crmFieldClass} name="companyName" defaultValue={lead.companyName} required />
                  <input className={crmFieldClass} name="contactName" defaultValue={lead.contactName} required />
                  <input className={crmFieldClass} name="contactPhone" defaultValue={lead.contactPhone} placeholder="Số điện thoại" required />
                  <input className={crmFieldClass} name="taxCode" defaultValue={lead.taxCode ?? ''} placeholder="Mã số thuế" />
                  <input className={crmFieldClass} name="address" defaultValue={lead.address ?? ''} placeholder="Địa chỉ" />
                  <CrmSelect
                    value={editSource}
                    required
                    placeholder="Nguồn khách"
                    options={SOURCES.map((item) => ({ value: item, label: leadSourceLabel(item) }))}
                    onChange={(next) => {
                      setEditSource(next as Exclude<SourceFilter, 'all' | 'unknown'>);
                      if (next !== 'partner') setEditPartnerId('');
                    }}
                  />
                  {editSource === 'partner' ? (
                    <CrmSelect
                      value={editPartnerId}
                      required
                      placeholder="Chọn cộng tác viên"
                      options={(partners.data ?? []).map((partner) => ({ value: partner.id, label: `${partner.name} · ${partner.code}` }))}
                      onChange={setEditPartnerId}
                    />
                  ) : null}
                  {canReassign ? (
                    <CrmSelect
                      value={editOwnerId}
                      placeholder="Người phụ trách"
                      options={(owners.data ?? []).map((owner) => ({ value: owner.id, label: owner.name }))}
                      onChange={setEditOwnerId}
                    />
                  ) : null}
                  <input className={crmFieldClass} type="date" value={editFollowUp} onChange={(event) => setEditFollowUp(event.target.value)} aria-label="Ngày hẹn gọi lại" />
                  <button type="submit" className={crmButtonClass} disabled={saveLead.isPending}>
                    {saveLead.isPending ? 'Đang lưu…' : 'Lưu lead'}
                  </button>
                </form>
              ) : null}
            </CrmCard>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
