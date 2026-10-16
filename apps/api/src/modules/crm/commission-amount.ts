/** Tiền hoa hồng từ số đã thanh toán và tỷ lệ nguyên. Làm tròn nửa lên. Không chi tiền. */
export function commissionVnd(paidAmountVnd: bigint, percent: number): bigint {
  if (paidAmountVnd <= 0n) return 0n;
  if (!Number.isInteger(percent) || percent < 1 || percent > 30) return 0n;
  return (paidAmountVnd * BigInt(percent) + 50n) / 100n;
}
