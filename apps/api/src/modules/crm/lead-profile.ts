import { BadRequestException } from '@nestjs/common';
import {
  CRM_LEAD_JOB_TITLES,
  CRM_LEAD_ORG_FIELDS,
  CRM_LEAD_ORG_TYPES,
  CRM_LEAD_REVENUE_BANDS,
  resolveVnProvince2025,
  type CreateCrmLeadRequest,
  type UpdateCrmLeadRequest,
} from '@industriallink/contracts';

type LeadProfileInput = CreateCrmLeadRequest | UpdateCrmLeadRequest;

export interface CrmLeadProfileData {
  contactEmail: string | null;
  zalo: string | null;
  jobTitle: string | null;
  department: string | null;
  industry: string | null;
  bankAccount: string | null;
  bankName: string | null;
  foundedOn: Date | null;
  orgType: string | null;
  orgField: string | null;
  revenueBand: string | null;
  country: string;
  province: string | null;
  ward: string | null;
  street: string | null;
  areaCode: string | null;
  address: string | null;
}

function clip(value: string | null | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function oneOf(value: string | null | undefined, allowed: readonly string[], message: string): string | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  if (!allowed.includes(text)) throw new BadRequestException(message);
  return text;
}

function digits(value: string | null | undefined, max: number, message: string): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  if (!/^\d+$/.test(text) || text.length > max) throw new BadRequestException(message);
  return text;
}

function foundedOn(raw: string | null | undefined): Date | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Ngày thành lập là ngày tháng năm');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException('Ngày thành lập không hợp lệ');
  }
  return date;
}

/** Các trường không bắt buộc trên tiềm năng. Giá trị lạ bị từ chối. */
export function readLeadProfile(input: LeadProfileInput): CrmLeadProfileData {
  const email = input.contactEmail?.trim() ?? '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Email chưa đúng dạng');
  }
  const zalo = (input.zalo ?? '').replace(/\D/g, '');
  if (zalo && (zalo.length < 8 || zalo.length > 15)) {
    throw new BadRequestException('Số Zalo gồm 8 đến 15 số');
  }
  const provinceRaw = input.province?.trim() ?? '';
  const province = provinceRaw ? resolveVnProvince2025(provinceRaw) : null;
  if (provinceRaw && !province) throw new BadRequestException('Chọn một trong 34 tỉnh, thành');
  return {
    contactEmail: email || null,
    zalo: zalo || null,
    jobTitle: oneOf(input.jobTitle, CRM_LEAD_JOB_TITLES, 'Chọn chức danh trong danh sách'),
    department: clip(input.department, 80) || null,
    industry: clip(input.industry, 120) || null,
    bankAccount: digits(input.bankAccount, 30, 'Số tài khoản chỉ gồm chữ số'),
    bankName: clip(input.bankName, 80) || null,
    foundedOn: foundedOn(input.foundedOn),
    orgType: oneOf(input.orgType, CRM_LEAD_ORG_TYPES, 'Chọn loại hình trong danh sách'),
    orgField: oneOf(input.orgField, CRM_LEAD_ORG_FIELDS, 'Chọn lĩnh vực trong danh sách'),
    revenueBand: oneOf(input.revenueBand, CRM_LEAD_REVENUE_BANDS, 'Chọn khung doanh thu trong danh sách'),
    country: 'Việt Nam',
    province,
    ward: clip(input.ward, 120) || null,
    street: clip(input.street, 160) || null,
    areaCode: clip(input.areaCode, 12) || null,
    address: clip(input.address, 300) || null,
  };
}
