'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { errorText, matchesQuery, renewalLabel } from '@/components/crm/format';
import { useCrmRenewals } from '@/components/crm/use-crm-board';
import { createCrmDeal } from '@/lib/crm';

export function CrmRenewalsPanel() {
  const renewals = useCrmRenewals();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const addDeal = useMutation({
    mutationFn: (input: { leadId: string; title: string; planKind: 'platform' | 'sourcing'; planCode: string }) =>
      createCrmDeal(input),
    onSuccess: () => {
      setError(null);
      setPendingId(null);
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-renewals'] });
    },
    onError: (err) => {
      setPendingId(null);
      setError(errorText(err, 'Không tạo được deal gia hạn'));
    },
  });

  const rows = (renewals.data ?? []).filter((row) =>
    matchesQuery(query, [row.companyName, row.planName, row.planCode]),
  );

  return (
    <CrmFrame
      kicker="Khách đang dùng inlink"
      title="Ai sắp hết gói tin hoặc gói Săn"
      description="Danh sách lấy từ hạn gói đang gán. Tạo deal gia hạn không đổi gói trên tài khoản nhà tuyển dụng."
      placeholder="Tìm nhà máy sắp hết hạn"
      search={{ value: query, onChange: setQuery }}
      footnote="Hết hạn trong 30 ngày, hoặc quá hạn chưa tới 14 ngày. CRM không gán gói."
    >
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {renewals.isLoading ? <CrmEmpty>Đang tải khách sắp hết hạn…</CrmEmpty> : null}
      {renewals.isError ? <CrmEmpty>Không tải được danh sách gia hạn.</CrmEmpty> : null}
      {renewals.data && rows.length === 0 ? <CrmEmpty>Không có khách hết hạn trong cửa sổ này.</CrmEmpty> : null}
      {rows.length > 0 ? (
        <CrmCardGrid columns={3}>
          {rows.map((row) => {
            const key = `${row.kind}-${row.companyId}`;
            return (
              <div key={key} className="flex h-full flex-col gap-3">
                <CrmCard
                  tone={row.daysLeft < 7 ? 'rose' : 'orange'}
                  icon={<CalendarClock className="h-5 w-5" />}
                  title={`${row.companyName} · ${row.planName}`}
                  text={`${row.kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'} · ${renewalLabel(row.daysLeft)}. ${row.leadId ? 'Có lead để mở deal gia hạn.' : 'Chưa có lead khớp công ty này.'}`}
                  meta={row.planCode}
                />
                {row.leadId ? (
                  <button
                    type="button"
                    className="rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={addDeal.isPending}
                    onClick={() => {
                      setPendingId(key);
                      addDeal.mutate({
                        leadId: row.leadId!,
                        title: `Gia hạn ${row.planName} — ${row.companyName}`,
                        planKind: row.kind,
                        planCode: row.planCode,
                      });
                    }}
                  >
                    {pendingId === key && addDeal.isPending ? 'Đang tạo…' : 'Tạo deal gia hạn'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
