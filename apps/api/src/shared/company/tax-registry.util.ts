import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';

export interface TaxRegistryBusinessInfo {
  taxCode: string;
  businessName: string;
  address: string | null;
}

export type TaxRegistryLookupResult =
  | { status: 'valid'; info: TaxRegistryBusinessInfo }
  | { status: 'not_found' }
  | { status: 'unavailable' };

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ
const validCache = new Map<string, { info: TaxRegistryBusinessInfo; expiresAt: number }>();

/**
 * Tra cứu Mã số thuế Việt Nam từ dữ liệu thực (VietQR Business / Tổng cục Thuế).
 * Chấp nhận MST 10 chữ số hoặc 10 số-3 số (chi nhánh).
 */
export async function lookupVietnameseTaxCode(
  normalizedTaxCode: string,
): Promise<TaxRegistryLookupResult> {
  const clean = normalizedTaxCode.replace(/\s+/g, '').trim();
  if (!/^\d{10}(-\d{3})?$/.test(clean)) {
    return { status: 'not_found' };
  }

  const cached = validCache.get(clean);
  if (cached && cached.expiresAt > Date.now()) {
    return { status: 'valid', info: cached.info };
  }

  try {
    const response = await fetch(
      `https://api.vietqr.io/v2/business/${encodeURIComponent(clean)}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) {
      return response.status >= 500 ? { status: 'unavailable' } : { status: 'not_found' };
    }
    const body = (await response.json()) as {
      code?: string;
      data?: { id?: string; name?: string; address?: string };
    };
    const name = body.data?.name?.trim();
    if (body.code !== '00' || !name) {
      return { status: 'not_found' };
    }
    const info: TaxRegistryBusinessInfo = {
      taxCode: clean,
      businessName: name,
      address: body.data?.address?.trim() || null,
    };
    if (validCache.size > 500) {
      validCache.clear();
    }
    validCache.set(clean, { info, expiresAt: Date.now() + CACHE_TTL_MS });
    return { status: 'valid', info };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Xác thực bắt buộc MST tồn tại trên dữ liệu thực; ném lỗi rõ ràng nếu không hợp lệ hoặc cổng tra cứu tạm gián đoạn.
 */
export async function assertRealVietnameseTaxCode(
  normalizedTaxCode: string,
): Promise<TaxRegistryBusinessInfo> {
  const result = await lookupVietnameseTaxCode(normalizedTaxCode);
  if (result.status === 'valid') {
    return result.info;
  }
  if (result.status === 'not_found') {
    throw new BadRequestException(
      'Mã số thuế không tồn tại trên Cổng thông tin doanh nghiệp / Tổng cục Thuế. Vui lòng kiểm tra lại MST chính xác của công ty.',
    );
  }
  throw new ServiceUnavailableException(
    'Hệ thống tạm thời chưa kết nối được cổng tra cứu Mã số thuế. Vui lòng thử lại sau ít phút.',
  );
}
