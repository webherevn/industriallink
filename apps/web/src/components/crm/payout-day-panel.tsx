'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { fetchCrmPayoutDay, updateCrmPayoutDay } from '@/lib/crm';

export function CrmPayoutDayPanel() {
  const qc = useQueryClient();
  const payout = useQuery({ queryKey: ['crm-payout-day'], queryFn: fetchCrmPayoutDay });
  const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => updateCrmPayoutDay({ day: Number(day) }),
    onSuccess: (row) => {
      setDay('');
      setError(null);
      setSaved(true);
      qc.setQueryData(['crm-payout-day'], row);
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được ngày chi'));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(day);
    if (!Number.isInteger(value) || value < 1 || value > 28) {
      setSaved(false);
      setError('Ngày chi là số nguyên từ 1 đến 28');
      return;
    }
    save.mutate();
  }

  const current = payout.data?.day;
  const canEdit = payout.data?.canEdit === true;

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Ngày chi hoa hồng"
      description="Ngày trong tháng kế toán ghi đã chi cho các kỳ đã được phép chi. Đổi ngày không trừ ví và không chuyển khoản."
      footnote="Chọn từ ngày 1 đến 28 để tháng nào cũng có ngày này, kể cả tháng 2."
    >
      {payout.isLoading ? <CrmEmpty>Đang tải ngày chi…</CrmEmpty> : null}
      {payout.isError ? <CrmEmpty>Không tải được ngày chi.</CrmEmpty> : null}
      {payout.data ? (
        <section className="mx-auto w-full max-w-lg rounded-[22px] bg-white p-6 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Ngày đang đặt</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[#4c3ec9]">Ngày {current}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Mỗi tháng, đến ngày này kế toán ghi đã chi. Hệ thống không tự trừ ví. Sales xem được ngày này. Chỉ SuperAdmin được sửa.
          </p>
          {canEdit ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
              <label className="block text-sm font-medium text-slate-800" htmlFor="crm-payout-day">
                Ngày mới
              </label>
              <input
                id="crm-payout-day"
                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c4b5fd]"
                inputMode="numeric"
                min={1}
                max={28}
                step={1}
                placeholder="1–28"
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                  setSaved(false);
                }}
                required
              />
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {saved && current != null ? <p className="text-sm text-emerald-700">Đã lưu ngày {current} hàng tháng.</p> : null}
              <button type="submit" className={crmButtonClass} disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu ngày chi'}
              </button>
            </form>
          ) : (
            <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
              Tài khoản này chỉ xem. SuperAdmin đặt ngày chi trong mục này.
            </p>
          )}
        </section>
      ) : null}
    </CrmFrame>
  );
}
