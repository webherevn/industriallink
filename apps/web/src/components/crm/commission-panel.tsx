'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { fetchCrmCommission, updateCrmCommission } from '@/lib/crm';

export function CrmCommissionPanel() {
  const qc = useQueryClient();
  const commission = useQuery({ queryKey: ['crm-commission'], queryFn: fetchCrmCommission });
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => updateCrmCommission({ percent: Number(percent) }),
    onSuccess: (row) => {
      setPercent('');
      setError(null);
      setSaved(true);
      qc.setQueryData(['crm-commission'], row);
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được tỷ lệ'));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(percent);
    if (!Number.isInteger(value) || value < 0 || value > 30) {
      setSaved(false);
      setError('Tỷ lệ hoa hồng là số nguyên từ 0 đến 30');
      return;
    }
    save.mutate();
  }

  const current = commission.data?.percent;
  const canEdit = commission.data?.canEdit === true;

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Hoa hồng cộng tác viên"
      description="Một tỷ lệ dùng chung cho mọi cộng tác viên. Khoản tiền chỉ được ghi sau khi khách thanh toán gói trên inlink."
      footnote="Đổi tỷ lệ không sửa các khoản đã ghi. Chưa có ví và chưa có lệnh chi."
    >
      {commission.isLoading ? <CrmEmpty>Đang tải tỷ lệ hoa hồng…</CrmEmpty> : null}
      {commission.isError ? <CrmEmpty>Không tải được tỷ lệ hoa hồng.</CrmEmpty> : null}
      {commission.data ? (
        <section className="mx-auto w-full max-w-lg rounded-[22px] bg-white p-6 crm-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Tỷ lệ hiện tại</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[#4c3ec9]">
            {current == null ? 'Chưa đặt' : `${current}%`}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Mọi cộng tác viên dùng cùng một tỷ lệ. Sales xem được tỷ lệ này. Chỉ SuperAdmin được sửa.
          </p>
          {canEdit ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
              <label className="block text-sm font-medium text-slate-800" htmlFor="crm-commission-percent">
                Tỷ lệ mới
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="crm-commission-percent"
                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c4b5fd]"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  step={1}
                  placeholder="0–30"
                  value={percent}
                  onChange={(event) => {
                    setPercent(event.target.value);
                    setSaved(false);
                  }}
                  required
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {saved && current != null ? (
                <p className="text-sm text-emerald-700">Đã lưu tỷ lệ {current}% cho mọi cộng tác viên.</p>
              ) : null}
              <button type="submit" className={crmButtonClass} disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu tỷ lệ'}
              </button>
            </form>
          ) : (
            <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
              Tài khoản này chỉ xem. SuperAdmin đặt tỷ lệ trong mục này.
            </p>
          )}
        </section>
      ) : null}
    </CrmFrame>
  );
}
