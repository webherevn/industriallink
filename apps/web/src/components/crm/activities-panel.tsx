'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageCircle, NotebookPen, Phone, Receipt } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CrmActivityType } from '@industriallink/contracts';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { activityLabel, errorText, formatWhen, isFresh, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmActivity } from '@/lib/crm';

const TYPES = [
  { value: 'call', label: 'Gọi điện' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'visit', label: 'Gặp mặt' },
  { value: 'note', label: 'Ghi chú' },
] as const;

export function CrmActivitiesPanel() {
  const board = useCrmBoard();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [leadId, setLeadId] = useState('');
  const [activityType, setActivityType] = useState<(typeof TYPES)[number]['value']>('call');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => createCrmActivity({ leadId, activityType, summary }),
    onSuccess: () => {
      setSummary('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
    },
    onError: (err) => setError(errorText(err, 'Không ghi được nhật ký')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  const leads = board.data?.leads ?? [];
  const rows = (board.data?.activities ?? []).filter((row) =>
    matchesQuery(query, [row.companyName, row.summary, activityLabel(row.activityType), row.createdByName]),
  );

  return (
    <CrmFrame
      kicker="Cuộc gọi, Zalo và buổi gặp"
      title="Nhật ký gắn với từng lead"
      description="Mỗi dòng ghi lại việc đã chăm khách. Không đổi gói và không thu tiền."
      placeholder="Tìm theo nhà máy hoặc nội dung trao đổi"
      search={{ value: query, onChange: setQuery }}
      footnote="Nhật ký lưu cùng lead. CRM không gán gói."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] lg:grid-cols-4">
        <select className={crmFieldClass} value={leadId} required onChange={(event) => setLeadId(event.target.value)}>
          <option value="">Chọn lead</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.companyName}
            </option>
          ))}
        </select>
        <select
          className={crmFieldClass}
          value={activityType}
          onChange={(event) => setActivityType(event.target.value as (typeof TYPES)[number]['value'])}
        >
          {TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <input className={crmFieldClass} placeholder="Nội dung trao đổi" value={summary} onChange={(event) => setSummary(event.target.value)} required />
        <button type="submit" className={crmButtonClass} disabled={add.isPending || leads.length === 0}>
          {add.isPending ? 'Đang lưu…' : 'Ghi nhật ký'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {board.isLoading ? <CrmEmpty>Đang tải nhật ký…</CrmEmpty> : null}
      {board.isError ? <CrmEmpty>Không tải được nhật ký.</CrmEmpty> : null}
      {board.data && (board.data.activities ?? []).length === 0 ? <CrmEmpty>Chưa có nhật ký.</CrmEmpty> : null}
      {board.data && (board.data.activities ?? []).length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có nhật ký khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <CrmCardGrid columns={3}>
          {rows.map((row) => (
            <CrmCard
              key={row.id}
              tone={toneOf(row.activityType)}
              badge={isFresh(row.createdAt) ? 'Mới' : undefined}
              icon={iconOf(row.activityType)}
              title={`${activityLabel(row.activityType)} · ${row.companyName ?? 'Khách'}`}
              text={row.summary}
              meta={`${formatWhen(row.createdAt)} · ${row.createdByName}`}
            />
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

function toneOf(type: CrmActivityType): 'green' | 'sky' | 'orange' | 'violet' | 'indigo' {
  if (type === 'call') return 'green';
  if (type === 'zalo') return 'sky';
  if (type === 'visit') return 'orange';
  if (type === 'stage') return 'violet';
  if (type === 'payment') return 'green';
  return 'indigo';
}

function iconOf(type: CrmActivityType) {
  if (type === 'call') return <Phone className="h-5 w-5" />;
  if (type === 'zalo') return <MessageCircle className="h-5 w-5" />;
  if (type === 'visit') return <MapPin className="h-5 w-5" />;
  if (type === 'payment') return <Receipt className="h-5 w-5" />;
  return <NotebookPen className="h-5 w-5" />;
}
