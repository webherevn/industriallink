import { signedWalletBalance, walletRunningBalances } from './commission-wallet';

describe('signedWalletBalance', () => {
  it('keeps credits and subtracts a payout', () => {
    expect(
      signedWalletBalance([
        { kind: 'credit', amountVnd: 150_000n },
        { kind: 'credit', amountVnd: 50_000n },
        { kind: 'debit', amountVnd: 150_000n },
      ]),
    ).toBe(50_000n);
  });

  it('is zero when nothing has been recorded', () => {
    expect(signedWalletBalance([])).toBe(0n);
  });

  it('ghi số dư sau từng lần cộng và lần trừ', () => {
    expect(
      walletRunningBalances([
        { kind: 'credit', amountVnd: 150_000n },
        { kind: 'credit', amountVnd: 50_000n },
        { kind: 'debit', amountVnd: 150_000n },
      ]),
    ).toEqual([150_000n, 200_000n, 50_000n]);
  });
});
