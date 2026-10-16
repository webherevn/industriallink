'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { fetchCrmVat, updateCrmVat } from '@/lib/crm';

export function CrmVatPanel() {
  const qc = useQueryClient();
  const vat = useQuery({ queryKey: ['crm-vat'], queryFn: fetchCrmVat });
  const [percent, setPercent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => updateCrmVat({ percent: Number(percent) }),
    onSuccess: (row) => {
      setPercent('');
      setError(null);
      setSaved(true);
      qc.setQueryData(['crm-vat'], row);
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được thuế suất'));
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(percent);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setSaved(false);
      setError('Thuế suất là số nguyên từ 0 đến 100');
      return;
    }
    save.mutate();
  }

  const current = vat.data?.percent;
  const canEdit = vat.data?.canEdit === true;

  return (
    <CrmFrame
      kicker="Cài đặt"
      title="Thuế suất"
      description="Để trống cho đến khi chốt mức thuế. Đặt thuế suất không đổi giá niêm yết và không cộng vào đơn đã thanh toán."
      footnote="Không tự điền 8% hay 10%."
    >
      {vat.isLoading ? <CrmEmpty>Đang tải thuế suất…</CrmEmpty> : null}
      {vat.isError ? <CrmEmpty>Không tải được thuế suất.</CrmEmpty> : null}
      {vat.data ? (
        <section className="mx-auto w-full max-w-lg rounded-[22px] bg-white p-6 shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Mức đang đặt</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[#4c3ec9]">{current == null ? 'Chưa đặt' : `${current}%`}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Sales xem được mức này. Chỉ SuperAdmin được nhập. Khi chưa đặt, sổ hóa đơn không hiện một con số thuế.
          </p>
          {canEdit ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
              <label className="block text-sm font-medium text-slate-800" htmlFor="crm-vat-percent">
                Thuế suất mới
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="crm-vat-percent"
                  className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c4b5fd]"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="0–100"
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
              {saved && current != null ? <p className="text-sm text-emerald-700">Đã lưu thuế suất {current}%.</p> : null}
              <button type="submit" className={crmButtonClass} disabled={save.isPending}>
                {save.isPending ? 'Đang lưu…' : 'Lưu thuế suất'}
              </button>
            </form>
          ) : (
            <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
              Tài khoản này chỉ xem. SuperAdmin nhập thuế suất trong mục này.
            </p>
          )}
        </section>
      ) : null}
    </CrmFrame>
  );
}
