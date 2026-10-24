import type { CompanyBrandProfile, CompanyCultureItem } from '@industriallink/contracts';
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

export type CultureStoredItem = CompanyCultureItem & {
  storageKey?: string | null;
  mime?: string | null;
};

export type BrandJson = Omit<CompanyBrandProfile, 'cultureGallery'> & {
  logoStorageKey?: string | null;
  logoMime?: string | null;
  bannerStorageKey?: string | null;
  bannerMime?: string | null;
  cultureGallery?: CultureStoredItem[];
  verificationRequest?: VerificationRequestStored | null;
};

export function readBrandJson(raw: Prisma.JsonValue | null | undefined): BrandJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as BrandJson) };
}

/** Hồ sơ công khai — không lộ khóa lưu trữ hay đơn xác minh. */
export function toPublicBrand(stored: BrandJson): CompanyBrandProfile {
  const {
    logoStorageKey: _logoKey,
    logoMime: _logoMime,
    bannerStorageKey: _bannerKey,
    bannerMime: _bannerMime,
    verificationRequest: _verification,
    cultureGallery,
    ...rest
  } = stored;
  return {
    ...rest,
    cultureGallery: (cultureGallery ?? []).map((item) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      caption: item.caption,
    })),
  };
}
