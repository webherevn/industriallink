/** 3 hàng đầu: Tin đăng Plus và Doanh nghiệp. */
const SPOTLIGHT_SLOTS = 6;
/** 2 hàng tiếp: Tin đăng và Enterprise. */
const PAID_SLOTS = 4;
/** Hàng cuối: Khám phá. */
const STARTER_SLOTS = 2;

const WORK_START_MIN = 8 * 60;
const WORK_END_MIN = 17 * 60;
const DAY_MIN = 24 * 60;

type Tier = 'spotlight' | 'paid' | 'starter';

/** Tin đăng Plus là gói tin nổi bật (chuyên sâu). Enterprise nằm cùng các gói trả phí còn lại. */
export function listingTier(planCode: string | null | undefined): Tier {
  if (planCode === 'TIN_DANG_PLUS' || planCode === 'DOANH_NGHIEP') return 'spotlight';
  if (planCode === 'TIN_DANG' || planCode === 'ENTERPRISE') return 'paid';
  return 'starter';
}

function vnMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Vị trí bắt đầu trong vòng xoay.
 * 08:00–17:00 chạy hết một vòng, 17:00–08:00 chạy hết một vòng nữa.
 * Mỗi tin đứng ở trang đầu đúng cùng số bước, nên thời gian hiện bằng nhau và giờ làm được ưu tiên.
 */
export function fairStepIndex(jobCount: number, slots: number, now: Date): number {
  if (jobCount <= slots) return 0;
  const mins = vnMinutes(now);
  const inWork = mins >= WORK_START_MIN && mins < WORK_END_MIN;
  const progress = inWork
    ? (mins - WORK_START_MIN) / (WORK_END_MIN - WORK_START_MIN)
    : (mins >= WORK_END_MIN ? mins - WORK_END_MIN : mins + (DAY_MIN - WORK_END_MIN)) /
      (DAY_MIN - (WORK_END_MIN - WORK_START_MIN));
  return Math.min(jobCount - 1, Math.floor(progress * jobCount));
}

function pageOfTier<T>(jobs: T[], slots: number, pageIndex: number, now: Date): T[] {
  if (jobs.length === 0 || pageIndex < 0) return [];
  if (jobs.length <= slots) return pageIndex === 0 ? jobs : [];
  const offset = fairStepIndex(jobs.length, slots, now) % jobs.length;
  const rotated = jobs.slice(offset).concat(jobs.slice(0, offset));
  if (pageIndex === 0) return rotated.slice(0, slots);
  const rest = rotated.slice(slots);
  const start = (pageIndex - 1) * slots;
  return rest.slice(start, start + slots);
}

function tierPageCount(count: number, slots: number): number {
  if (count <= 0) return 0;
  return Math.ceil(count / slots);
}

/** Trang 12 ô: 6 tin đầu, 4 tin trả phí, 2 tin Khám phá. Thiếu nhóm thì để trống, không lấy tin nhóm khác. */
export function composeJobBoard<T extends { planCode?: string | null }>(
  jobs: T[],
  pageIndex: number,
  now = new Date(),
): { page: T[]; totalPages: number } {
  const spotlight: T[] = [];
  const paid: T[] = [];
  const starter: T[] = [];
  for (const job of jobs) {
    const tier = listingTier(job.planCode);
    if (tier === 'spotlight') spotlight.push(job);
    else if (tier === 'paid') paid.push(job);
    else starter.push(job);
  }
  const totalPages = Math.max(
    1,
    tierPageCount(spotlight.length, SPOTLIGHT_SLOTS),
    tierPageCount(paid.length, PAID_SLOTS),
    tierPageCount(starter.length, STARTER_SLOTS),
  );
  const index = Math.min(Math.max(0, pageIndex), totalPages - 1);
  return {
    page: [
      ...pageOfTier(spotlight, SPOTLIGHT_SLOTS, index, now),
      ...pageOfTier(paid, PAID_SLOTS, index, now),
      ...pageOfTier(starter, STARTER_SLOTS, index, now),
    ],
    totalPages,
  };
}
