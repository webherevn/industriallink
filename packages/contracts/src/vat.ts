/** Tiền VAT làm tròn đồng. Chưa đặt mức, mức không hợp lệ hoặc giá không dương thì bằng 0. */
export function vatAmountVnd(priceVnd: bigint | string, percent: number | null | undefined): bigint {
  if (typeof percent !== 'number' || !Number.isInteger(percent) || percent <= 0 || percent > 100) return 0n;
  const price = typeof priceVnd === 'bigint' ? priceVnd : BigInt(priceVnd || '0');
  if (price <= 0n) return 0n;
  return (price * BigInt(percent) + 50n) / 100n;
}

/** Số khách thanh toán: giá chưa VAT cộng tiền VAT. */
export function payableVnd(priceVnd: bigint | string, percent: number | null | undefined): bigint {
  const price = typeof priceVnd === 'bigint' ? priceVnd : BigInt(priceVnd || '0');
  return price + vatAmountVnd(price, percent);
}
