'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { CrmCommissionEntryView } from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { errorText, formatVnd, formatWhen } from '@/components/crm/format';
import { createMyPartnerClaim, fetchMyPartner, registerMyPartner } from '@/lib/crm';

export function RecruiterPartnerPanel() {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const register = useMutation({
    mutationFn: () => registerMyPartner({ phone }),
    onSuccess: () => {
      setError(null);
      setPhone('');
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không đăng ký được cộng tác viên')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    register.mutate();
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const partner = mine.data?.partner ?? null;

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-accent-600" />
            <h1 className="text-xl font-bold text-slate-900">Cộng tác viên</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Mỗi tài khoản một mã. Link ghi cookie 14 ngày. Khách đăng ký và thanh toán gói trong hạn đó thì hoa hồng về mã này.
          </p>
        </div>

        {mine.isLoading ? <Card className="p-5 text-sm text-slate-500">Đang tải mã của bạn…</Card> : null}
        {mine.isError ? <Card className="p-5 text-sm text-rose-600">Không tải được mã giới thiệu.</Card> : null}

        {mine.data && !partner ? (
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Đăng ký làm cộng tác viên</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dùng tên tài khoản đang đăng nhập. Nhập số điện thoại để nhận mã. Không tạo mã thứ hai cho tài khoản này.
            </p>
            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="Số điện thoại"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? 'Đang tạo mã…' : 'Đăng ký'}
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          </Card>
        ) : null}

        {partner ? (
          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mã của tài khoản này</p>
            <p className="mt-2 text-3xl font-bold tracking-wide text-[#072348]">{partner.code}</p>
            <p className="mt-1 text-sm text-slate-500">{partner.name} · {partner.phone}</p>
            <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="referral-link">
              Link giới thiệu
            </label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                id="referral-link"
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
                value={partner.referralUrl}
              />
              <Button type="button" variant="outline" onClick={() => void copyLink(partner.referralUrl)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Đã chép' : 'Chép link'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Khách mở link rồi đăng ký nhà tuyển dụng. Trong 14 ngày, thanh toán gói thành công thì hoa hồng về mã này.{' '}
              {mine.data?.commissionPercent == null
                ? 'Chưa đặt tỷ lệ hoa hồng.'
                : `Hoa hồng hiện tại ${mine.data.commissionPercent}%. Khoản chỉ ghi sau khi khách thanh toán, và đang chờ đối soát.`}
            </p>
          </Card>
        ) : null}
        {partner && mine.data ? <CommissionLines entries={mine.data.commissions} /> : null}
        {partner ? <FactoryClaim claims={partner.claims} /> : null}
      </div>
    </RecruiterShell>
  );
}

function CommissionLines({ entries }: { entries: CrmCommissionEntryView[] }) {
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Chờ đối soát</h2>
      <p className="mt-1 text-sm text-slate-500">
        Các khoản dưới đây ghi sau khi khách thanh toán gói. Chưa chi và không rút tại đây.
      </p>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chưa có khoản nào.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-100 px-3 py-3">
              <p className="text-sm font-medium text-slate-900">{entry.companyName}</p>
              <p className="mt-1 text-sm text-slate-600">
                {entry.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
                {entry.planName ? ` · ${entry.planName}` : ''} · {entry.percent}% · {formatVnd(entry.commissionVnd)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Thanh toán {formatWhen(entry.paidAt)} · Chờ đối soát</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FactoryClaim({
  claims,
}: {
  claims: Array<{ id: string; companyName: string; taxCode: string }>;
}) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createMyPartnerClaim({ companyName, taxCode, contactPhone: phone }),
    onSuccess: () => {
      setCompanyName('');
      setTaxCode('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['recruiter-partner'] });
    },
    onError: (err) => setError(errorText(err, 'Không khóa được mã số thuế')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-slate-900">Nhà máy đã khóa</h2>
      <p className="mt-1 text-sm text-slate-500">
        Mã số thuế 10 hoặc 13 số. Nhà máy này không về cộng tác viên khác. Tối đa 30 mã.
      </p>
      {claims.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {claims.map((claim) => (
            <li key={claim.id}>
              {claim.companyName} · MST {claim.taxCode}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Chưa khóa mã số thuế nào.</p>
      )}
      <form onSubmit={onSubmit} className="mt-4 grid gap-3">
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Tên nhà máy" value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} required />
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} required />
        <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Số điện thoại HR" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </Card>
  );
}
