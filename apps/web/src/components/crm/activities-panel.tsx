'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageCircle, NotebookPen, Phone, Receipt } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { CrmActivityType } from '@industriallink/contracts';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmDateField, CrmField, CrmSelect } from '@/components/crm/fields';
import { activityLabel, errorText, followUpLabel, formatWhen, isFresh, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmActivity, fetchCrmFollowUps } from '@/lib/crm';

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
  const [followUp, setFollowUp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const followUps = useQuery({ queryKey: ['crm-follow-ups'], queryFn: fetchCrmFollowUps });

  const add = useMutation({
    mutationFn: () => createCrmActivity({ leadId, activityType, summary, nextFollowUpAt: followUp || undefined }),
    onSuccess: () => {
      setSummary('');
      setFollowUp('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-follow-ups'] });
    },
    onError: (err) => setError(errorText(err, 'Không ghi được nhật ký')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  const leads = board.data?.leads ?? [];
  const rows = (board.data?.activities ?? []).filter((row) =>
    matchesQuery(query, [row.companyName, row.summary, activityLabel(row.activityType), row.createdByName, row.invoiceNumber]),
  );

  return (
    <CrmFrame
      kicker="Cuộc gọi, Zalo và buổi gặp"
      title="Nhật ký gắn với từng lead"
      description="Ghi việc đã chăm khách và đặt ngày gọi lại. Không đổi gói và không thu tiền."
      placeholder="Tìm theo nhà máy hoặc nội dung trao đổi"
      search={{ value: query, onChange: setQuery }}
      footnote="Nhật ký lưu cùng lead. CRM không gán gói."
    >
      <form onSubmit={onSubmit} className="grid items-end gap-3 rounded-[22px] bg-white p-4 crm-surface lg:grid-cols-5">
        <CrmField label="Tiềm năng *">
          <CrmSelect
            value={leadId}
            required
            placeholder="Chọn tiềm năng"
            options={leads.map((lead) => ({ value: lead.id, label: lead.companyName }))}
            onChange={setLeadId}
          />
        </CrmField>
        <CrmField label="Hình thức">
          <CrmSelect
            value={activityType}
            options={TYPES.map((type) => ({ value: type.value, label: type.label }))}
            onChange={(next) => setActivityType(next as (typeof TYPES)[number]['value'])}
          />
        </CrmField>
        <CrmField label="Nội dung *">
          <input className={crmFieldClass} aria-label="Nội dung trao đổi" value={summary} onChange={(event) => setSummary(event.target.value)} required />
        </CrmField>
        <CrmField label="Ngày hẹn gọi lại">
          <CrmDateField value={followUp} onChange={setFollowUp} placeholder="Chưa hẹn" />
        </CrmField>
        <button type="submit" className={crmButtonClass} disabled={add.isPending || leads.length === 0}>
          {add.isPending ? 'Đang lưu…' : 'Ghi nhật ký'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {followUps.data && followUps.data.length > 0 ? (
        <div className="grid gap-2">
          {followUps.data.map((lead) => (
            <Link
              key={lead.id}
              href={lead.companyId ? `/crm/companies/${lead.companyId}` : '/crm/leads'}
              className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 crm-surface"
            >
              <span className="font-semibold text-slate-900">{lead.companyName}</span>
              {lead.nextFollowUpAt ? ` · ${followUpLabel(lead.nextFollowUpAt)}` : ''} · {lead.ownerName}
            </Link>
          ))}
        </div>
      ) : null}
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
            >
              {row.activityType === 'payment' ? (
                <Link
                  href={`/crm/finance?q=${encodeURIComponent(row.invoiceNumber ?? row.companyName ?? '')}`}
                  className={`mt-3 text-xs font-medium underline ${row.invoiceNumber ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {row.invoiceNumber ? `Hóa đơn ${row.invoiceNumber}` : 'Chưa ghi số hóa đơn'}
                </Link>
              ) : null}
            </CrmCard>
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
