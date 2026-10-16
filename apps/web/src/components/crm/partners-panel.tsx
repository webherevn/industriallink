'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { CrmCard, CrmCardGrid, CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText, matchesQuery } from '@/components/crm/format';
import { useCrmBoard } from '@/components/crm/use-crm-board';
import { createCrmPartner, fetchCrmPartners } from '@/lib/crm';

export function CrmPartnersPanel() {
  const qc = useQueryClient();
  const board = useCrmBoard();
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const [query, setQuery] = useState('');
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
      description="Mỗi người có một mã và một link bảng giá. Khách để lại thông tin trên link thì thành lead của mã đó. Chưa tính phần trăm hoa hồng."
      placeholder="Tìm tên, số điện thoại hoặc mã"
      search={{ value: query, onChange: setQuery }}
      footnote="Hoa hồng chưa mở. Mã này chưa khóa lead theo mã số thuế."
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
      {partners.data && rows.length === 0 ? <CrmEmpty>Chưa có cộng tác viên khớp bộ lọc.</CrmEmpty> : null}
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
                text={`${partner.phone}. ${leadCount} lead gắn mã này. ${partner.fromAccount ? 'Tài khoản NTD tự đăng ký.' : 'CRM tạo hộ.'} ${partner.referralUrl}`}
                meta={partner.code}
              />
            );
          })}
        </CrmCardGrid>
      ) : null}
    </CrmFrame>
  );
}
