import type { CompanyBrandProfile } from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';

export interface VerificationRequestStored {
  status: 'pending' | 'approved' | 'rejected';
  note: string;
  requestedAt: string;
  requestedBy: string;
  askVerified: boolean;
  askTrusted: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
}

export type BrandJson = CompanyBrandProfile & {
  logoStorageKey?: string | null;
  logoMime?: string | null;
  verificationRequest?: VerificationRequestStored | null;
};

export function readBrandJson(raw: Prisma.JsonValue | null | undefined): BrandJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as BrandJson) };
}

/** Hồ sơ công khai — không lộ khóa lưu trữ hay đơn xác minh. */
export function toPublicBrand(stored: BrandJson): CompanyBrandProfile {
  const { logoStorageKey: _k, logoMime: _m, verificationRequest: _v, ...rest } = stored;
  return rest;
}
