/** 3 hàng đầu: Tin đăng Plus và Doanh nghiệp. */
const SPOTLIGHT_SLOTS = 6;
/** 2 hàng tiếp: Tin đăng và Enterprise. */
const PAID_SLOTS = 4;
/** Hàng cuối: Khám phá. */
const STARTER_SLOTS = 2;

/** Mỗi nhóm đổi bộ tin đang đứng ở trang đầu theo nhịp này. */
export const LISTING_ROTATE_MS = 10_000;

type Tier = 'spotlight' | 'paid' | 'starter';

/** Tin đăng Plus là gói tin nổi bật (chuyên sâu). Enterprise nằm cùng các gói trả phí còn lại. */
export function listingTier(planCode: string | null | undefined): Tier {
  if (planCode === 'TIN_DANG_PLUS' || planCode === 'DOANH_NGHIEP') return 'spotlight';
  if (planCode === 'TIN_DANG' || planCode === 'ENTERPRISE') return 'paid';
  return 'starter';
}

function rotationTick(now: Date): number {
  return Math.floor(now.getTime() / LISTING_ROTATE_MS);
}

/**
 * Xoay đúng một nhóm.
 * Mỗi 10 giây, cửa sổ trang đầu của nhóm nhảy đúng số ô của nhóm đó.
 * Hết một vòng, mỗi tin đứng ở trang đầu cùng số nhịp, không phụ thuộc nhóm nhiều hay ít tin.
 */
function rotateTier<T>(jobs: T[], slots: number, now: Date): T[] {
  if (jobs.length <= slots) return jobs.slice();
  const offset = (rotationTick(now) * slots) % jobs.length;
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
