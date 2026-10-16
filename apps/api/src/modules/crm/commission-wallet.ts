/** Số dư ví là tổng dòng cộng trừ tổng dòng trừ. Số trên từng dòng luôn dương. */
export function signedWalletBalance(txns: Array<{ kind: string; amountVnd: bigint }>): bigint {
  return txns.reduce((sum, row) => sum + (row.kind === 'debit' ? -row.amountVnd : row.amountVnd), 0n);
}

/** Số dư ngay sau từng dòng, theo đúng thứ tự thời gian được đưa vào. */
export function walletRunningBalances(txns: Array<{ kind: string; amountVnd: bigint }>): bigint[] {
  let balance = 0n;
  return txns.map((row) => {
    balance += row.kind === 'debit' ? -row.amountVnd : row.amountVnd;
    return balance;
  });
}
