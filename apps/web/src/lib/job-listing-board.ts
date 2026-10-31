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

function rotateTier<T>(jobs: T[], slots: number, now: Date): T[] {
  if (jobs.length <= slots) return jobs.slice();
  const offset = fairStepIndex(jobs.length, slots, now) % jobs.length;
  return jobs.slice(offset).concat(jobs.slice(0, offset));
}

function take<T>(queue: T[], count: number): T[] {
  if (count <= 0 || queue.length === 0) return [];
  return queue.splice(0, count);
}

/** Lấy đủ số ô, ưu tiên đúng nhóm rồi tới các nhóm còn tin. */
function takePrefer<T>(count: number, sources: T[][]): T[] {
  const picked: T[] = [];
  for (const source of sources) {
    if (picked.length >= count) break;
    picked.push(...take(source, count - picked.length));
  }
  return picked;
}

/**
 * Một trang đủ 12 tin khi còn tin.
 * Đủ cả ba nhóm thì giữ 6 + 4 + 2.
 * Nhóm nào thiếu thì nhóm khác lấp cho đầy trang, không để trống ô phía trên.
 */
function fillPage<T>(spotlight: T[], paid: T[], starter: T[]): T[] {
  const top = takePrefer(SPOTLIGHT_SLOTS, [spotlight, paid, starter]);
  const mid = takePrefer(PAID_SLOTS, [paid, spotlight, starter]);
  const bot = takePrefer(STARTER_SLOTS, [starter, paid, spotlight]);
  return [...top, ...mid, ...bot];
}

/** Trang 12 ô. Thiếu nhóm nào thì lấy tin nhóm khác lấp cho đủ trang. */
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

  const spotlightQueue = rotateTier(spotlight, SPOTLIGHT_SLOTS, now);
  const paidQueue = rotateTier(paid, PAID_SLOTS, now);
  const starterQueue = rotateTier(starter, STARTER_SLOTS, now);
  const pages: T[][] = [];
  while (spotlightQueue.length > 0 || paidQueue.length > 0 || starterQueue.length > 0) {
    const page = fillPage(spotlightQueue, paidQueue, starterQueue);
    if (page.length === 0) break;
    pages.push(page);
  }

  const totalPages = Math.max(1, pages.length);
  const index = Math.min(Math.max(0, pageIndex), totalPages - 1);
  return { page: pages[index] ?? [], totalPages };
}
