'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { claimCrmCustomer, fetchCrmUnclaimed } from '@/lib/crm';

export function CrmInboxPanel() {
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ['crm-unclaimed'], queryFn: fetchCrmUnclaimed });
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: (companyId: string) => claimCrmCustomer(companyId),
    onSuccess: () => {
      setError(null);
      setPendingId(null);
      void qc.invalidateQueries({ queryKey: ['crm-unclaimed'] });
      void qc.invalidateQueries({ queryKey: ['crm-board'] });
      void qc.invalidateQueries({ queryKey: ['crm-renewals'] });
    },
    onError: (err) => {
      setPendingId(null);
      setError(errorText(err, 'Không nhận được khách'));
    },
  });

  const rows = (customers.data ?? []).filter((row) =>
    matchesQuery(query, [row.companyName, row.taxCode, row.contactName, row.lastPlanName, row.contactEmail]),
  );

  return (
    <CrmFrame
      kicker="Đã thanh toán trên inlink"
      title="Khách tự mua, chưa có người phụ trách"
      description="Nhà tuyển dụng đăng ký và trả gói mà sale chưa tạo lead. Bấm nhận để khách vào tên bạn. Không gán thêm gói."
      placeholder="Tìm công ty hoặc mã số thuế"
      search={{ value: query, onChange: setQuery }}
      footnote="Khách đã có lead thì không hiện ở đây. Nhận khách không tạo đơn mới."
    >
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {customers.isLoading ? <CrmEmpty>Đang tải khách tự mua…</CrmEmpty> : null}
      {customers.isError ? <CrmEmpty>Không tải được khách tự mua.</CrmEmpty> : null}
      {customers.data && customers.data.length === 0 ? <CrmEmpty>Không có khách tự mua nào đang chờ.</CrmEmpty> : null}
      {customers.data && customers.data.length > 0 && rows.length === 0 ? <CrmEmpty>Không có khách khớp từ khóa.</CrmEmpty> : null}
      {rows.length > 0 ? (
        <CrmCardGrid columns={3}>
          {rows.map((row) => (
            <div key={row.companyId} className="flex h-full flex-col gap-3">
              <CrmCard
                tone="indigo"
                icon={<Inbox className="h-5 w-5" />}
                title={row.companyName}
                text={`${row.lastPlanName ?? 'Gói đã trả'} · ${formatVnd(row.lastPaidAmountVnd)} · ${formatWhen(row.lastPaidAt)}. ${row.contactName ?? 'Chưa rõ người liên hệ'}${row.taxCode ? ` · MST ${row.taxCode}` : ''}.`}
                meta={row.contactEmail ?? 'Chưa có email'}
              />
              <div className="flex gap-2">
                <Link
                  href={`/crm/companies/${row.companyId}`}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Hồ sơ
                </Link>
                <button
                  type="button"
                  className="rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={claim.isPending}
                  onClick={() => {
                    setPendingId(row.companyId);
                    claim.mutate(row.companyId);
                  }}
                >
                  {pendingId === row.companyId ? 'Đang nhận…' : 'Nhận khách'}
                </button>
              </div>
            </div>
          ))}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
