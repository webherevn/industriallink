'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrmQuoteView } from '@industriallink/contracts';
import { Building2, Landmark } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { CrmEmpty, CrmFrame, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { CrmField, CrmFormSection } from '@/components/crm/fields';
import { errorText, vietnamDay } from '@/components/crm/format';
import { QuoteDocument } from '@/components/crm/quote-document';
import { fetchCrmQuoteForm, fetchCrmQuoteFormLogoObjectUrl, saveCrmQuoteForm, uploadCrmQuoteFormLogo } from '@/lib/crm';

const BLANK = {
  legalName: '',
  taxCode: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  bankAccount: '',
  bankHolder: '',
  transferNote: '',
  terms: '',
  signerTitle: '',
};

type Draft = typeof BLANK;

export function CrmQuoteFormPanel() {
  const qc = useQueryClient();
  const form = useQuery({ queryKey: ['crm-quote-form'], queryFn: fetchCrmQuoteForm });
  const logo = useQuery({
    queryKey: ['crm-quote-form-logo'],
    queryFn: fetchCrmQuoteFormLogoObjectUrl,
    enabled: Boolean(form.data?.hasLogo),
  });
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!form.data || hydrated.current) return;
    hydrated.current = true;
    setDraft({
      legalName: form.data.legalName ?? '',
      taxCode: form.data.taxCode ?? '',
      address: form.data.address ?? '',
      phone: form.data.phone ?? '',
      email: form.data.email ?? '',
      website: form.data.website ?? '',
      bankName: form.data.bankName ?? '',
      bankAccount: form.data.bankAccount ?? '',
      bankHolder: form.data.bankHolder ?? '',
      transferNote: form.data.transferNote ?? '',
      terms: form.data.terms ?? '',
      signerTitle: form.data.signerTitle ?? '',
    });
  }, [form.data]);

  const save = useMutation({
    mutationFn: () =>
      saveCrmQuoteForm({
        legalName: draft.legalName || null,
        taxCode: draft.taxCode || null,
        address: draft.address || null,
        phone: draft.phone || null,
        email: draft.email || null,
        website: draft.website || null,
        bankName: draft.bankName || null,
        bankAccount: draft.bankAccount || null,
        bankHolder: draft.bankHolder || null,
        transferNote: draft.transferNote || null,
        terms: draft.terms || null,
        signerTitle: draft.signerTitle || null,
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ['crm-quote-form'] });
    },
    onError: (err) => {
      setSaved(false);
      setError(errorText(err, 'Không lưu được mẫu tờ'));
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => uploadCrmQuoteFormLogo(file),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['crm-quote-form'] });
      await qc.invalidateQueries({ queryKey: ['crm-quote-form-logo'] });
    },
    onError: (err) => setError(errorText(err, 'Không tải được logo')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  }

  function setField(key: keyof Draft, value: string) {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  if (form.isLoading) return <CrmEmpty>Đang tải mẫu tờ…</CrmEmpty>;
  if (form.isError) return <CrmEmpty>Không tải được mẫu tờ.</CrmEmpty>;
  if (form.data && !form.data.canEdit) return <CrmEmpty>Chỉ SuperAdmin sửa mẫu tờ báo giá.</CrmEmpty>;

  const previewForm = {
    legalName: draft.legalName || null,
    taxCode: draft.taxCode || null,
    address: draft.address || null,
    phone: draft.phone || null,
    email: draft.email || null,
    website: draft.website || null,
    bankName: draft.bankName || null,
    bankAccount: draft.bankAccount || null,
    bankHolder: draft.bankHolder || null,
    transferNote: draft.transferNote || null,
    terms: draft.terms || null,
    signerTitle: draft.signerTitle || null,
  };

  return (
    <CrmFrame
      kicker="Mẫu tờ báo giá"
      title="Phần cố định in trên mọi tờ"
      description="Logo, thông tin công ty, tài khoản và điều khoản. Giá và các đợt vẫn lấy từ từng báo giá."
    >
      <div className="flex justify-start">
        <Link href="/crm/quotes" className="text-sm font-semibold text-[#4c3ec9]">
          Về danh sách báo giá
        </Link>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-[22px] bg-white p-4 crm-surface md:grid-cols-2">
        <CrmFormSection icon={<Building2 className="h-3.5 w-3.5" />}>Công ty phát hành</CrmFormSection>
        <CrmField label="Logo" className="md:col-span-2">
          <input
            className={crmFieldClass}
            aria-label="Logo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const next = URL.createObjectURL(file);
              setLocalLogo((current) => {
                if (current) URL.revokeObjectURL(current);
                return next;
              });
              upload.mutate(file);
            }}
          />
        </CrmField>
        <CrmField label="Tên pháp lý">
          <input className={crmFieldClass} aria-label="Tên pháp lý" value={draft.legalName} onChange={(event) => setField('legalName', event.target.value)} />
        </CrmField>
        <CrmField label="Mã số thuế">
          <input className={crmFieldClass} aria-label="Mã số thuế công ty" inputMode="numeric" value={draft.taxCode} onChange={(event) => setField('taxCode', event.target.value)} />
        </CrmField>
        <CrmField label="Địa chỉ" className="md:col-span-2">
          <input className={crmFieldClass} aria-label="Địa chỉ công ty phát hành" value={draft.address} onChange={(event) => setField('address', event.target.value)} />
        </CrmField>
        <CrmField label="Điện thoại">
          <input className={crmFieldClass} aria-label="Điện thoại công ty" value={draft.phone} onChange={(event) => setField('phone', event.target.value)} />
        </CrmField>
        <CrmField label="Email">
          <input className={crmFieldClass} aria-label="Email công ty" value={draft.email} onChange={(event) => setField('email', event.target.value)} />
        </CrmField>
        <CrmField label="Website">
          <input className={crmFieldClass} aria-label="Website" value={draft.website} onChange={(event) => setField('website', event.target.value)} />
        </CrmField>
        <CrmField label="Chức danh người ký">
          <input className={crmFieldClass} aria-label="Chức danh người ký" value={draft.signerTitle} onChange={(event) => setField('signerTitle', event.target.value)} />
        </CrmField>
        <CrmFormSection icon={<Landmark className="h-3.5 w-3.5" />}>Tài khoản và điều khoản</CrmFormSection>
        <CrmField label="Ngân hàng">
          <input className={crmFieldClass} aria-label="Ngân hàng" value={draft.bankName} onChange={(event) => setField('bankName', event.target.value)} />
        </CrmField>
        <CrmField label="Số tài khoản">
          <input className={crmFieldClass} aria-label="Số tài khoản" inputMode="numeric" value={draft.bankAccount} onChange={(event) => setField('bankAccount', event.target.value)} />
        </CrmField>
        <CrmField label="Chủ tài khoản">
          <input className={crmFieldClass} aria-label="Chủ tài khoản" value={draft.bankHolder} onChange={(event) => setField('bankHolder', event.target.value)} />
        </CrmField>
        <CrmField label="Nội dung chuyển khoản">
          <input className={crmFieldClass} aria-label="Nội dung chuyển khoản" value={draft.transferNote} onChange={(event) => setField('transferNote', event.target.value)} />
        </CrmField>
        <CrmField label="Điều khoản" className="md:col-span-2">
          <textarea className={`${crmFieldClass} min-h-32`} aria-label="Điều khoản" value={draft.terms} onChange={(event) => setField('terms', event.target.value)} maxLength={4000} />
        </CrmField>
        <button type="submit" className={`${crmButtonClass} md:col-span-2`} disabled={save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu mẫu'}
        </button>
      </form>
      {upload.isPending ? <p className="text-center text-sm text-slate-500">Đang tải logo…</p> : null}
      {saved ? <p className="text-center text-sm text-emerald-700">Đã lưu mẫu. Báo giá đã lập không đổi giá.</p> : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      <div className="space-y-3">
        <p className="text-center text-sm font-semibold text-[#4c3ec9]">Xem trước · không phải báo giá đã lưu</p>
        <p className="text-center text-xs text-slate-500">Tờ Enterprise dùng cùng đầu trang, điều khoản và tài khoản. Phần giữa là các đợt của hợp đồng.</p>
        <QuoteDocument quote={sampleQuote()} form={previewForm} logoUrl={localLogo ?? logo.data ?? null} />
      </div>
    </CrmFrame>
  );
}

function sampleQuote(): CrmQuoteView {
  return {
    id: 'preview',
    quoteCode: 'BG-0000-XEM',
    companyName: 'Công ty mẫu',
    taxCode: '0100000000',
    contactName: 'Người liên hệ mẫu',
    contactPhone: '0900000000',
    contactEmail: 'lienhe@congtymau.vn',
    address: 'Khu công nghiệp mẫu, Việt Nam',
    quotedOn: vietnamDay(new Date().toISOString()),
    validUntil: null,
    status: 'draft',
    companyId: null,
    dealId: null,
    dealTitle: null,
    dealCode: null,
    ownerUserId: 'preview',
    ownerName: 'Sale mẫu',
    quoteKind: 'catalog',
    installments: [],
    receivableVnd: '0',
    collectedVnd: '0',
    option1Kind: 'platform',
    option1Code: 'MAU',
    option1Name: 'Gói tin mẫu',
    option1PriceVnd: '1000000',
    option2Kind: 'sourcing',
    option2Code: 'MAU2',
    option2Name: 'Gói Săn mẫu',
    option2PriceVnd: '1500000',
    note: 'Mô tả mẫu trên tờ.',
    vatPercent: null,
    createdAt: new Date().toISOString(),
  };
}
