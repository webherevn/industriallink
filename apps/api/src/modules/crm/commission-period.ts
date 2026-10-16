const PERIOD_MONTH = /^(\d{4})-(\d{2})$/;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type CommissionCloseLine = {
  id: string;
  partnerId: string;
  paidAmountVnd: bigint;
  commissionVnd: bigint;
};

export type CommissionCloseGroup = {
  partnerId: string;
  ids: string[];
  paidAmountVnd: bigint;
  commissionVnd: bigint;
  entryCount: number;
};

/** Đầu và cuối tháng dương lịch theo giờ Việt Nam. `end` là đúng 00:00 ngày 1 tháng sau. */
export function vietnamMonthBounds(periodMonth: string): { start: Date; end: Date } | null {
  const match = PERIOD_MONTH.exec(periodMonth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, -7, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, -7, 0, 0)),
  };
}

export function vietnamPeriodMonth(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}`;
}

export function previousVietnamPeriodMonth(now = new Date()): string {
  const [yearText, monthText] = vietnamPeriodMonth(now).split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

export function groupCommissionClose(entries: CommissionCloseLine[]): CommissionCloseGroup[] {
  const grouped = new Map<string, CommissionCloseGroup>();
  for (const entry of entries) {
    const current = grouped.get(entry.partnerId) ?? {
      partnerId: entry.partnerId,
      ids: [],
      paidAmountVnd: 0n,
      commissionVnd: 0n,
      entryCount: 0,
    };
    current.ids.push(entry.id);
    current.paidAmountVnd += entry.paidAmountVnd;
    current.commissionVnd += entry.commissionVnd;
    current.entryCount += 1;
    grouped.set(entry.partnerId, current);
  }
  return [...grouped.values()];
}
