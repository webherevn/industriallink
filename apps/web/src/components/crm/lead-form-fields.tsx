'use client';

import {
  CRM_LEAD_JOB_TITLES,
  CRM_LEAD_ORG_FIELDS,
  CRM_LEAD_ORG_TYPES,
  CRM_LEAD_REVENUE_BANDS,
  VN_PROVINCES_2025,
  type CrmCompanyOption,
  type CrmLeadView,
  type CrmTaxSuggestion,
} from '@industriallink/contracts';
import { Building2, Landmark, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { crmFieldClass } from '@/components/crm-frame';
import { CrmDateField, CrmField, CrmFormSection, CrmSelect } from '@/components/crm/fields';

export type LeadDraft = {
  taxCode: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  zalo: string;
  jobTitle: string;
  department: string;
  address: string;
  bankAccount: string;
  bankName: string;
  foundedOn: string;
  orgType: string;
  orgField: string;
  industry: string;
  revenueBand: string;
  province: string;
  ward: string;
  street: string;
  areaCode: string;
  source: string;
  partnerId: string;
  campaignId: string;
};

export function blankLeadDraft(): LeadDraft {
  return {
    taxCode: '',
    companyName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    zalo: '',
    jobTitle: '',
    department: '',
    address: '',
    bankAccount: '',
    bankName: '',
    foundedOn: '',
    orgType: '',
    orgField: '',
    industry: '',
    revenueBand: '',
    province: '',
    ward: '',
    street: '',
    areaCode: '',
    source: '',
    partnerId: '',
    campaignId: '',
  };
}

export function draftFromLead(lead: CrmLeadView): LeadDraft {
  return {
    taxCode: lead.taxCode ?? '',
    companyName: lead.companyName,
    contactName: lead.contactName,
    contactPhone: lead.contactPhone,
    contactEmail: lead.contactEmail ?? '',
    zalo: lead.zalo ?? '',
    jobTitle: lead.jobTitle ?? '',
    department: lead.department ?? '',
    address: lead.address ?? '',
    bankAccount: lead.bankAccount ?? '',
    bankName: lead.bankName ?? '',
    foundedOn: lead.foundedOn ?? '',
    orgType: lead.orgType ?? '',
    orgField: lead.orgField ?? '',
    industry: lead.industry ?? '',
    revenueBand: lead.revenueBand ?? '',
    province: lead.province ?? '',
    ward: lead.ward ?? '',
    street: lead.street ?? '',
    areaCode: lead.areaCode ?? '',
    source: lead.source === 'unknown' ? '' : lead.source,
    partnerId: lead.partnerId ?? '',
    campaignId: lead.campaignId ?? '',
  };
}

function optional(name: string, items: readonly string[]) {
  return [{ value: '', label: name }, ...items.map((item) => ({ value: item, label: item }))];
}

export function LeadFormFields({
  draft,
  onChange,
  campaignOptions,
  sources,
  partners,
  partnersLoading,
  taxOpen,
  onTaxFocus,
  onTaxBlur,
  suggestions,
  onPickTax,
  companies,
  onPickCompany,
  extra,
}: {
  draft: LeadDraft;
  onChange: (next: LeadDraft) => void;
  campaignOptions: Array<{ value: string; label: string }>;
  sources: Array<{ value: string; label: string }>;
  partners: Array<{ id: string; name: string; code: string }>;
  partnersLoading: boolean;
  taxOpen: boolean;
  onTaxFocus: () => void;
  onTaxBlur: () => void;
  suggestions: CrmTaxSuggestion[] | undefined;
  onPickTax: (item: CrmTaxSuggestion) => void;
  companies: CrmCompanyOption[] | undefined;
  onPickCompany: (company: CrmCompanyOption) => void;
  extra?: ReactNode;
}) {
  function set<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <>
      <CrmFormSection icon={<Building2 className="h-3.5 w-3.5" />}>Thông tin chung</CrmFormSection>
      <div className="relative">
        <CrmField label="Mã số thuế *">
          <input
            className={crmFieldClass}
            aria-label="Mã số thuế"
            inputMode="numeric"
            autoComplete="off"
            placeholder="10 hoặc 13 số"
            value={draft.taxCode}
            required
            onFocus={onTaxFocus}
            onBlur={onTaxBlur}
            onChange={(event) => set('taxCode', event.target.value)}
          />
        </CrmField>
        {taxOpen && suggestions && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-56 w-[min(100vw-2rem,28rem)] overflow-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
            {suggestions.map((item) => (
              <li key={`${item.source}-${item.taxCode}-${item.companyId ?? 'registry'}`}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#efeaff]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onPickTax(item)}
                >
                  <span className="font-medium text-slate-800">{item.companyName}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    MST {item.taxCode} · {item.source === 'inlink' ? 'Trên inlink' : 'Sổ thuế'}
                  </span>
                  {item.address ? <span className="mt-0.5 block text-xs text-slate-500">{item.address}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="relative">
        <CrmField label="Tên công ty *">
          <input className={crmFieldClass} aria-label="Tên công ty" value={draft.companyName} required onChange={(event) => set('companyName', event.target.value)} />
        </CrmField>
        {companies && companies.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
            {companies.map((company) => (
              <li key={company.id}>
                <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-[#efeaff]" onClick={() => onPickCompany(company)}>
                  <span className="font-medium text-slate-800">{company.name}</span>
                  {company.taxCode ? <span className="mt-0.5 block text-xs text-slate-400">MST {company.taxCode}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <CrmField label="Người liên hệ *">
        <input className={crmFieldClass} aria-label="Người liên hệ" value={draft.contactName} required onChange={(event) => set('contactName', event.target.value)} />
      </CrmField>
      <CrmField label="Nguồn khách *">
        <CrmSelect
          value={draft.source}
          required
          placeholder="Chọn nguồn"
          options={sources}
          onChange={(next) => onChange({ ...draft, source: next, partnerId: next === 'partner' ? draft.partnerId : '' })}
        />
      </CrmField>
      <CrmField label="Số điện thoại">
        <input className={crmFieldClass} aria-label="Số điện thoại" value={draft.contactPhone} onChange={(event) => set('contactPhone', event.target.value)} />
      </CrmField>
      <CrmField label="Email">
        <input className={crmFieldClass} aria-label="Email" type="email" value={draft.contactEmail} onChange={(event) => set('contactEmail', event.target.value)} />
      </CrmField>
      <CrmField label="Số Zalo">
        <input className={crmFieldClass} aria-label="Số Zalo" value={draft.zalo} onChange={(event) => set('zalo', event.target.value)} />
      </CrmField>
      <CrmField label="Chức danh">
        <CrmSelect value={draft.jobTitle} placeholder="Chọn chức danh" options={optional('Chọn chức danh', CRM_LEAD_JOB_TITLES)} onChange={(next) => set('jobTitle', next)} />
      </CrmField>
      <CrmField label="Bộ phận">
        <input className={crmFieldClass} aria-label="Bộ phận" value={draft.department} onChange={(event) => set('department', event.target.value)} />
      </CrmField>
      <CrmField label="Chiến dịch">
        <CrmSelect
          value={draft.campaignId}
          placeholder="Không gắn"
          options={[{ value: '', label: 'Không gắn' }, ...campaignOptions]}
          onChange={(next) => set('campaignId', next)}
        />
      </CrmField>
      {draft.source === 'partner' ? (
        <CrmField label="Cộng tác viên *">
          <CrmSelect
            value={draft.partnerId}
            required
            placeholder={partnersLoading ? 'Đang tải cộng tác viên…' : 'Chọn cộng tác viên'}
            options={partners.map((partner) => ({ value: partner.id, label: `${partner.name} · ${partner.code}` }))}
            onChange={(next) => set('partnerId', next)}
          />
        </CrmField>
      ) : null}

      <CrmFormSection icon={<Landmark className="h-3.5 w-3.5" />}>Thông tin tổ chức</CrmFormSection>
      <CrmField label="Tài khoản ngân hàng">
        <input className={crmFieldClass} aria-label="Tài khoản ngân hàng" inputMode="numeric" value={draft.bankAccount} onChange={(event) => set('bankAccount', event.target.value)} />
      </CrmField>
      <CrmField label="Mở tại ngân hàng">
        <input className={crmFieldClass} aria-label="Mở tại ngân hàng" value={draft.bankName} onChange={(event) => set('bankName', event.target.value)} />
      </CrmField>
      <CrmField label="Ngày thành lập">
        <CrmDateField value={draft.foundedOn} onChange={(next) => set('foundedOn', next)} />
      </CrmField>
      <CrmField label="Loại hình">
        <CrmSelect value={draft.orgType} placeholder="Chọn loại hình" options={optional('Chọn loại hình', CRM_LEAD_ORG_TYPES)} onChange={(next) => set('orgType', next)} />
      </CrmField>
      <CrmField label="Lĩnh vực">
        <CrmSelect value={draft.orgField} placeholder="Chọn lĩnh vực" options={optional('Chọn lĩnh vực', CRM_LEAD_ORG_FIELDS)} onChange={(next) => set('orgField', next)} />
      </CrmField>
      <CrmField label="Ngành nghề">
        <input className={crmFieldClass} aria-label="Ngành nghề" value={draft.industry} onChange={(event) => set('industry', event.target.value)} />
      </CrmField>
      <CrmField label="Doanh thu">
        <CrmSelect value={draft.revenueBand} placeholder="Chọn doanh thu" options={optional('Chọn doanh thu', CRM_LEAD_REVENUE_BANDS)} onChange={(next) => set('revenueBand', next)} />
      </CrmField>

      <CrmFormSection icon={<MapPin className="h-3.5 w-3.5" />}>Thông tin địa chỉ</CrmFormSection>
      <CrmField label="Quốc gia">
        <CrmSelect value="Việt Nam" placeholder="Quốc gia" options={[{ value: 'Việt Nam', label: 'Việt Nam' }]} onChange={() => undefined} />
      </CrmField>
      <CrmField label="Tỉnh/Thành phố">
        <CrmSelect
          value={draft.province}
          placeholder="Chọn tỉnh, thành"
          options={optional('Chọn tỉnh, thành', VN_PROVINCES_2025)}
          onChange={(next) => set('province', next)}
        />
      </CrmField>
      <CrmField label="Phường/Xã">
        <input className={crmFieldClass} aria-label="Phường/Xã" value={draft.ward} onChange={(event) => set('ward', event.target.value)} />
      </CrmField>
      <CrmField label="Số nhà, đường phố">
        <input className={crmFieldClass} aria-label="Số nhà, đường phố" value={draft.street} onChange={(event) => set('street', event.target.value)} />
      </CrmField>
      <CrmField label="Mã vùng">
        <input className={crmFieldClass} aria-label="Mã vùng" value={draft.areaCode} onChange={(event) => set('areaCode', event.target.value)} />
      </CrmField>
      <CrmField label="Địa chỉ">
        <input className={crmFieldClass} aria-label="Địa chỉ" value={draft.address} onChange={(event) => set('address', event.target.value)} />
      </CrmField>
      <p className="md:col-span-2 text-xs text-slate-400">34 tỉnh, thành từ 01/7/2025. Không còn cấp quận, huyện. Phường, xã ghi bằng chữ.</p>
      {extra}
    </>
  );
}
