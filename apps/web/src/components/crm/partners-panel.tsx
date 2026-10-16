'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmPartnerView } from '@industriallink/contracts';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, formatVnd, formatWhen, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmPartner, createCrmPartnerClaim, fetchCrmPartners } from '@/lib/crm';

export function CrmPartnersPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const qc = useQueryClient();
  const board = useCrmBoard();
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const [query, setQuery] = useState(initialQuery);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => createCrmPartner({ name, phone }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không tạo được cộng tác viên')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  const rows = (partners.data ?? []).filter((partner) =>
    matchesQuery(query, [partner.name, partner.phone, partner.code]),
  );

  return (
    <CrmFrame
      kicker="Người giới thiệu khách"
      title="Cộng tác viên và mã giới thiệu"
      description="Mỗi người có một mã và một link bảng giá. Số trên thẻ là hoa hồng chờ đối soát mà bạn được xem, cùng sổ với trang của cộng tác viên."
      placeholder="Tìm tên, số điện thoại hoặc mã"
      search={{ value: query, onChange: setQuery }}
      footnote="Một mã số thuế chỉ thuộc một cộng tác viên."
    >
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 shadow-[0_10px_28px_rgba(91,76,219,0.07)] md:grid-cols-3">
        <input className={crmFieldClass} placeholder="Tên cộng tác viên" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <button type="submit" className={crmButtonClass} disabled={add.isPending}>
          {add.isPending ? 'Đang lưu…' : 'Tạo mã'}
        </button>
      </form>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {partners.isLoading ? <CrmEmpty>Đang tải cộng tác viên…</CrmEmpty> : null}
      {partners.isError ? <CrmEmpty>Không tải được danh sách cộng tác viên.</CrmEmpty> : null}
      {partners.data && partners.data.length === 0 ? <CrmEmpty>Chưa có cộng tác viên.</CrmEmpty> : null}
      {partners.data && partners.data.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có cộng tác viên khớp bộ lọc.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <CrmCardGrid columns={3}>
          {rows.map((partner) => {
            const leadCount = (board.data?.leads ?? []).filter((lead) => lead.partnerId === partner.id).length;
            return (
              <CrmCard
                key={partner.id}
                tone="indigo"
                icon={<Users className="h-5 w-5" />}
                title={partner.name}
                text={`${partner.phone}. ${leadCount} lead. ${partner.signups.length} đã đăng ký, chưa thanh toán. Ví ${formatVnd(partner.walletBalanceVnd)}. ${formatVnd(partner.pendingCommissionVnd)} chờ đối soát (${partner.pendingCount} khoản). ${partner.fromAccount ? 'Tài khoản NTD tự đăng ký.' : 'CRM tạo hộ.'}`}
                meta={partner.code}
              >
                {partner.signups.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-slate-600">
                    {partner.signups.slice(0, 4).map((signup) => (
                      <li key={signup.id}>
                        {signup.companyName} · đăng ký {formatWhen(signup.registeredAt)}
                      </li>
                    ))}
                    {partner.signups.length > 4 ? <li>và {partner.signups.length - 4} tài khoản nữa</li> : null}
                  </ul>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href={`/crm/signups?q=${encodeURIComponent(partner.code)}`}
                    className={crmActionClass}
                  >
                    Đăng ký chưa trả
                  </Link>
                  <Link
                    href={`/crm/finance/reconciliation?q=${encodeURIComponent(partner.code)}`}
                    className={crmActionClass}
                  >
                    Xem đối soát
                  </Link>
                </div>
                <ClaimForm partner={partner} />
              </CrmCard>
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}

function ClaimForm({ partner }: { partner: CrmPartnerView }) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createCrmPartnerClaim(partner.id, { companyName, taxCode, contactPhone: phone }),
    onSuccess: () => {
      setCompanyName('');
      setTaxCode('');
      setPhone('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['crm-partners'] });
    },
    onError: (err) => setError(errorText(err, 'Không khóa được mã số thuế')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    add.mutate();
  }

  return (
    <div className="mt-3 space-y-2">
      {partner.claims.length > 0 ? (
        <ul className="space-y-1 text-[11px] text-slate-500">
          {partner.claims.map((claim) => (
            <li key={claim.id}>
              {claim.companyName} · MST {claim.taxCode}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-400">Chưa khóa mã số thuế</p>
      )}
      <form onSubmit={onSubmit} className="space-y-2">
        <input className={crmFieldClass} placeholder="Tên nhà máy" value={companyName} maxLength={160} onChange={(event) => setCompanyName(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Mã số thuế" value={taxCode} onChange={(event) => setTaxCode(event.target.value)} required />
        <input className={crmFieldClass} placeholder="Số điện thoại HR" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <button type="submit" className={crmButtonClass} disabled={add.isPending}>
          {add.isPending ? 'Đang khóa…' : 'Khóa mã số thuế'}
        </button>
      </form>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
