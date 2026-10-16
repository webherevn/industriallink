'use client';

import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { errorText } from '@/components/crm/format';
import { captureCrmReferral } from '@/lib/crm';

const CODE = /^CTV[0-9A-F]{4}$/i;

export function PricingReferralNote() {
  const code = useSearchParams().get('ref')?.trim() ?? '';
  return <ReferralForm code={code} />;
}

function ReferralForm({ code }: { code: string }) {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  if (!CODE.test(code)) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await captureCrmReferral({
        code,
        companyName,
        contactName,
        contactPhone,
        taxCode: taxCode || null,
        website,
      });
      setDone(true);
    } catch (err) {
      setError(errorText(err, 'Chưa gửi được. Thử lại sau.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto mb-6 max-w-3xl rounded-2xl bg-[#efeaff] px-4 py-4 text-[#3b2f86]">
      <p className="text-center text-sm">Bảng giá được mở từ mã giới thiệu {code.toUpperCase()}.</p>
      {done ? (
        <p className="mt-3 text-center text-sm font-medium">Đã ghi nhận. Đội kinh doanh sẽ liên hệ.</p>
      ) : (
        <form onSubmit={onSubmit} className="mx-auto mt-3 grid max-w-xl gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-[#ddd6fe] bg-white px-3 py-2 text-sm text-slate-800"
            placeholder="Tên công ty"
            value={companyName}
            maxLength={160}
            onChange={(event) => setCompanyName(event.target.value)}
            required
          />
          <input
            className="rounded-xl border border-[#ddd6fe] bg-white px-3 py-2 text-sm text-slate-800"
            placeholder="Người liên hệ"
            value={contactName}
            maxLength={80}
            onChange={(event) => setContactName(event.target.value)}
            required
          />
          <input
            className="rounded-xl border border-[#ddd6fe] bg-white px-3 py-2 text-sm text-slate-800 sm:col-span-2"
            placeholder="Mã số thuế, nếu có"
            value={taxCode}
            inputMode="numeric"
            onChange={(event) => setTaxCode(event.target.value)}
          />
          <input
            className="rounded-xl border border-[#ddd6fe] bg-white px-3 py-2 text-sm text-slate-800 sm:col-span-2"
            placeholder="Số điện thoại"
            value={contactPhone}
            inputMode="tel"
            autoComplete="tel"
            onChange={(event) => setContactPhone(event.target.value)}
            required
          />
          <input
            className="absolute -left-[9999px] h-px w-px"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-xl bg-[#072348] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
            disabled={pending}
          >
            {pending ? 'Đang gửi…' : 'Để lại thông tin'}
          </button>
          {error ? <p className="text-center text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
