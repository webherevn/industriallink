'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { errorText, isFresh, leadStatusLabel, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmLead } from '@/lib/crm';

type Filter = 'all' | 'open' | 'converted';

export function CrmLeadsPanel() {
  const board = useCrmBoard();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addLead = useMutation({
    mutationFn: () =>
      createCrmLead({
        companyName,
        contactName,
        contactPhone,
        taxCode: taxCode || null,
      }),
    onSuccess: () => {
      setCompanyName('');
      setContactName('');
      setContactPhone('');
      setTaxCode('');
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
    return matchesQuery(query, [lead.companyName, lead.contactName, lead.contactPhone, lead.taxCode, lead.leadCode]);
  });
  const all = board.data?.leads ?? [];

  return (
    <CrmFrame
      kicker="Nhà máy và người phụ trách HR"
      title="Lead chưa phải khách đã mua gói"
      description="Thêm lead không tạo tài khoản nhà tuyển dụng và không gán gói. Trùng mã số thuế thì gắn vào công ty đã có."
      placeholder="Tìm tên công ty, mã số thuế hoặc số điện thoại"
      search={{ value: query, onChange: setQuery }}
      footnote="CRM không gán gói và không cộng Credit."
      chips={
        <>
          <CrmChip active={filter === 'all'} onClick={() => setFilter('all')} icon={<CircleDot className="h-4 w-4" />} label={`Tất cả · ${all.length}`} />
          <CrmChip active={filter === 'open'} onClick={() => setFilter('open')} icon={<CircleDot className="h-4 w-4" />} label={`Đang mở · ${all.filter((lead) => lead.status === 'open').length}`} />
          <CrmChip active={filter === 'converted'} onClick={() => setFilter('converted')} icon={<CircleDot className="h-4 w-4" />} label={`Đã có deal · ${all.filter((lead) => lead.status === 'converted').length}`} />
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] md:grid-cols-5">
        <input className={crmFieldClass} placeholder="Tên công ty" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Người liên hệ" value={contactName} onChange={(event) => setContactName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Số điện thoại" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
        <button type="submit" className={crmButtonClass} disabled={addLead.isPending}>
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
              meta={`${lead.leadCode} · ${lead.ownerName}${lead.companyId ? ' · Đã khớp công ty trên inlink' : ''}`}
            />
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
