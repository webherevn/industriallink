/** Format balance credit (số nguyên) thành chuỗi ngắn gọn cho badge/tooltip. */
export function formatCreditBalance(balance: number): string {
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(1)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(1)}k`;
  return String(balance);
}

/**
 * Format số VND thành chuỗi hiển thị theo cấu hình billing.
 * - priceVnd: string (BigInt từ API)
 * - currency: BillingCurrencyDisplay
 */
import type { BillingCurrencyDisplay } from '@industriallink/contracts';

export function formatPriceVnd(priceVnd: string | number, currency: BillingCurrencyDisplay): string {
  const value = typeof priceVnd === 'string' ? BigInt(priceVnd) : BigInt(priceVnd);
  return formatBigInt(value, currency);
}

export function formatBigInt(value: bigint, currency: BillingCurrencyDisplay): string {
  // 1. Negative?
  const negative = value < 0n;
  const abs = negative ? -value : value;

  // 2. Tách phần nguyên + phần thập phân (chia 10^decimalDigits)
  const denom = 10n ** BigInt(currency.decimalDigits);
  const intPart = abs / denom;
  const fracPart = abs % denom;

  // 3. Format phần nguyên với thousands separator
  const intStr = intPart.toString();
  let groupedInt = intStr;
  if (currency.useThousandsSeparator && currency.thousandsSeparator) {
    groupedInt = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
  }

  let numStr = groupedInt;
  if (currency.decimalDigits > 0 && fracPart > 0n) {
    const fracStr = fracPart.toString().padStart(currency.decimalDigits, '0');
    numStr = `${groupedInt}.${fracStr}`;
  }

  if (negative) numStr = `-${numStr}`;

  // 4. Thêm ký hiệu tiền tệ
  const sym = currency.displaySymbol;
  return currency.symbolBefore ? `${sym}${numStr}` : `${numStr}${sym}`;
}

/**
 * Convert VND → USD tham chiếu (chỉ hiển thị, không dùng thanh toán).
 * Trả về string "~$XX" hoặc rỗng nếu thiếu config.
 */
export function formatReferenceUsd(priceVnd: string | number, currency: BillingCurrencyDisplay): string {
  if (!currency.showReferenceUsd || !currency.usdToVndRateHundredths) return '';
  const vnd = typeof priceVnd === 'string' ? BigInt(priceVnd) : BigInt(priceVnd);
  const rate = BigInt(currency.usdToVndRateHundredths); // USD × 100
  if (rate === 0n) return '';
  // usd = vnd * 100 / rate (làm tròn 2 chữ số)
  const usdHundredths = (vnd * 100n) / rate;
  const usdInt = usdHundredths / 100n;
  const usdFrac = usdHundredths % 100n;
  const usdStr = usdFrac === 0n ? usdInt.toString() : `${usdInt}.${usdFrac.toString().padStart(2, '0')}`;
  return `~$${usdStr}`;
}
