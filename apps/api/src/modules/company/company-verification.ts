import { BadRequestException } from '@nestjs/common';
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

export interface VerificationLicenseStored {
  storageKey: string;
  mime: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
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
  licenseDoc?: VerificationLicenseStored | null;
};

/**
 * Chuẩn hoá và kiểm tra định dạng Mã số thuế Việt Nam:
 * - 10 chữ số (doanh nghiệp độc lập), hoặc
 * - 10 chữ số + '-' + 3 chữ số (đơn vị phụ thuộc / chi nhánh).
 */
export function normalizeAndValidateTaxCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const compact = raw.replace(/\s+/g, '').trim();
  if (!compact) return null;
  if (!/^\d{10}(-\d{3})?$/.test(compact)) {
    throw new BadRequestException(
      'Mã số thuế không đúng định dạng (cần 10 chữ số hoặc 10 chữ số-3 chữ số cho chi nhánh, VD: 0101234567).',
    );
  }
  return compact;
}

export function readBrandJson(raw: Prisma.JsonValue | null | undefined): BrandJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as BrandJson) };
}

/** Hồ sơ công khai — không lộ khóa lưu trữ, đơn xác minh hay giấy phép ĐKKD. */
export function toPublicBrand(stored: BrandJson): CompanyBrandProfile {
  const { cultureGallery, ...rest } = stored;
  // Loại các field nội bộ (khóa lưu trữ + đơn xác minh + GPKD riêng tư) khỏi hồ sơ công khai.
  delete rest.logoStorageKey;
  delete rest.logoMime;
  delete rest.bannerStorageKey;
  delete rest.bannerMime;
  delete rest.verificationRequest;
  delete rest.licenseDoc;
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
