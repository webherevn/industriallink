'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { errorText } from '@/components/crm/format';
import { fetchMyPartner, registerMyPartner } from '@/lib/crm';

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
            Mỗi tài khoản một mã. Đăng ký xong có link bảng giá riêng. Hoa hồng chưa mở.
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
              Khách mở link, xem bảng giá và có thể để lại tên với số điện thoại. Thông tin đó thành lead trong CRM. Hoa hồng chưa tính.
            </p>
          </Card>
        ) : null}
      </div>
    </RecruiterShell>
  );
}
