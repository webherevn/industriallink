export function vietnamDateIso(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function commissionClosedNotice(periodMonth: string, closedCount: number): { title: string; body: string; link: string } {
  return {
    title: `Đã tự chốt hoa hồng ${periodLabel(periodMonth)}`,
    body: `${closedCount} cộng tác viên đã vào kỳ chốt. Vào xem để cho phép chi. Ví chưa trừ.`,
    link: '/crm/finance/periods',
  };
}

export function payoutDayReminderNotice(day: number, waitingCount: number): { title: string; body: string; link: string } {
  return {
    title: `Hôm nay là ngày ${day}, còn kỳ chờ chi`,
    body: `${waitingCount} kỳ đã được phép chi. Ghi đã chi trên mục Kế toán. Ví không tự trừ và không chuyển khoản.`,
    link: '/crm/finance/accounting',
  };
}

/** Chỉ nhắc một lần trong ngày chi, và chỉ khi còn kỳ đang chờ ghi đã chi. */
export function shouldRemindPayoutDay(input: {
  todayIso: string;
  payoutDay: number;
  remindedOn: string | null;
  payableCount: number;
}): boolean {
  const day = Number(input.todayIso.slice(8, 10));
  if (!Number.isInteger(day) || day !== input.payoutDay) return false;
  if (input.remindedOn === input.todayIso) return false;
  return input.payableCount > 0;
}

export function vatPercentOrEmpty(value: number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100) return value;
  return null;
}

/** Câu bảng giá và FAQ. Không điền 8% hay 10% khi chưa đặt. */
export function publicVatSentence(percent: number | null): string {
  if (percent == null) {
    return 'Giá hiển thị chưa bao gồm VAT. Thuế suất chưa đặt, thanh toán bằng giá niêm yết.';
  }
  return `Giá hiển thị chưa bao gồm VAT ${percent}%. Khi thanh toán cộng thêm ${percent}%.`;
}

export function applyPublicVatCopy(answer: string, percent: number | null): string {
  if (!/Giá hiển thị chưa bao gồm VAT/i.test(answer) && !/VAT\s*10\s*%/i.test(answer)) return answer;
  return publicVatSentence(percent);
}

function periodLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split('-');
  if (!year || !month) return periodMonth;
  return `tháng ${Number(month)}/${year}`;
}
