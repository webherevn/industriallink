'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleDot } from 'lucide-react';
import { FormEvent, useState } from 'react';
import {
  CrmCard,
  CrmCardGrid,
  CrmChip,
  CrmEmpty,
  CrmFrame,
  crmButtonClass,
  crmFieldClass,
} from '@/components/crm-frame';
import { errorText, isFresh, leadSourceLabel, leadStatusLabel, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmLead, fetchCrmCompanies, fetchCrmPartners } from '@/lib/crm';

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
  const [error, setError] = useState<string | null>(null);

  const partners = useQuery({
    queryKey: ['crm-partners'],
    queryFn: fetchCrmPartners,
    enabled: source === 'partner',
  });

  const companies = useQuery({
    queryKey: ['crm-companies', companyName],
    queryFn: () => fetchCrmCompanies(companyName),
    enabled: companyName.trim().length >= 2 && !companyId,
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
      setSource('');
      setPartnerId('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được lead')),
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
      description="Thêm lead không tạo tài khoản nhà tuyển dụng và không gán gói. Chọn nguồn khách. Nguồn cộng tác viên chưa tính hoa hồng."
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
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] md:grid-cols-2 xl:grid-cols-6">
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
        <input className={crmFieldClass} placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
        <select
          className={crmFieldClass}
          value={source}
          required
          onChange={(event) => {
            const next = event.target.value as typeof source;
            setSource(next);
            if (next !== 'partner') setPartnerId('');
          }}
        >
          <option value="">Nguồn khách</option>
          {SOURCES.map((item) => (
            <option key={item} value={item}>
              {leadSourceLabel(item)}
            </option>
          ))}
        </select>
        {source === 'partner' ? (
          <select className={crmFieldClass} value={partnerId} required onChange={(event) => setPartnerId(event.target.value)}>
            <option value="">{partners.isLoading ? 'Đang tải cộng tác viên…' : 'Chọn cộng tác viên'}</option>
            {partners.data?.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} · {partner.code}
              </option>
            ))}
          </select>
        ) : null}
        <button type="submit" className={crmButtonClass} disabled={addLead.isPending || !source || (source === 'partner' && !partnerId)}>
          {addLead.isPending ? 'Đang lưu…' : 'Thêm lead'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải lead…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được danh sách lead.</CrmEmpty> : null}
      {board.data && leads.length === 0 ? <CrmEmpty>Chưa có lead khớp bộ lọc.</CrmEmpty> : null}
      {leads.length > 0 ? (
        <CrmCardGrid columns={3}>
          {leads.map((lead) => (
            <CrmCard
              key={lead.id}
              tone={lead.status === 'converted' ? 'green' : 'sky'}
              badge={isFresh(lead.createdAt) ? 'Mới' : undefined}
              icon={<Building2 className="h-5 w-5" />}
              title={lead.companyName}
              text={`${lead.contactName} · ${lead.contactPhone}${lead.taxCode ? ` · MST ${lead.taxCode}` : ''}. ${leadStatusLabel(lead.status)}.`}
              meta={`${lead.leadCode} · ${lead.partnerName ? `${lead.partnerName} (${lead.partnerCode})` : leadSourceLabel(lead.source)} · ${lead.ownerName}${lead.companyId ? ' · Đã khớp công ty trên inlink' : ''}`}
            />
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
