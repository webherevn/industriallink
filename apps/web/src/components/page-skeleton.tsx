'use client';

import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { isCmsAdminRole, isSalesStaff, UserRole } from '@industriallink/contracts';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Skeleton dùng chung cho `loading.tsx` của các nhóm giao diện
 * (Ứng viên / Nhà tuyển dụng / Cộng tác viên).
 *
 * Lưu ý quan trọng:
 * - `loading.tsx` thay thế TOÀN BỘ page, mà page đó lại chứa luôn
 *   `AppShell` / `RecruiterShell`. Nếu skeleton không vẽ lại khung
 *   (header + sidebar) thì lúc chuyển trang sẽ "nhảy" layout.
 *   Vì vậy skeleton có sẵn 2 bộ chrome: `candidate` (top nav) và
 *   `recruiter` (sidebar).
 * - Vì `AppShell` tự chuyển sang `RecruiterShell` khi role ≠ Ứng viên,
 *   skeleton đọc role đã cache trong React Query để chọn đúng chrome.
 *   Fallback (chưa có cache) dùng `tone` truyền vào.
 * - File này KHÔNG dùng hook React Query / không gọi API
 *   → an toàn render ở server (loading boundary).
 */

type Tone = 'candidate' | 'recruiter' | 'public';

/**
 * - `auto`    → suy ra từ role trong React Query cache (mặc định)
 * - `public`  → ép header công khai (route `allowGuest`)
 */
type ChromeMode = 'auto' | 'public';

function SkeletonBar({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx('animate-pulse rounded-lg bg-slate-200/80', className)} style={style} />
  );
}

/** Khối thẻ dùng chung cho danh sách. */
export function SkeletonCard({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar className="h-3.5 w-2/5" />
          <SkeletonBar className="h-3 w-4/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBar key={i} className={clsx('h-2.5', i % 2 === 0 ? 'w-full' : 'w-5/6')} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome: top nav của ứng viên (AppShell)                              */
/* ------------------------------------------------------------------ */

function CandidateHeaderChrome() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:h-16 sm:px-6">
        <SkeletonBar className="h-7 w-24" />
        <nav className="ml-1 hidden flex-1 items-center gap-4 lg:flex">
          {[72, 56, 68, 92, 60, 64].map((w, i) => (
            <SkeletonBar key={i} className="h-3.5" style={{ width: w }} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SkeletonBar className="h-9 w-24 rounded-lg" />
          <SkeletonBar className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome: sidebar của nhà tuyển dụng (RecruiterShell)                  */
/* ------------------------------------------------------------------ */

function RecruiterSidebarChrome() {
  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
      <div className="px-4 py-5">
        <SkeletonBar className="h-7 w-28" />
      </div>
      <div className="flex-1 space-y-5 overflow-hidden px-3 pb-4">
        {[1, 1, 4, 4, 2, 3, 3].map((count, group) => (
          <div key={group} className="space-y-2">
            {group > 0 ? <SkeletonBar className="mx-2.5 h-2 w-20" /> : null}
            {Array.from({ length: count }).map((_, i) => (
              <SkeletonBar key={i} className="mx-1 h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200/70 bg-slate-50/70 px-2.5 py-2">
        <SkeletonBar className="h-12 w-full rounded-xl" />
      </div>
    </aside>
  );
}

function RecruiterHeaderChrome() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0 space-y-2">
          <SkeletonBar className="h-4 w-44" />
          <SkeletonBar className="hidden h-3 w-72 sm:block" />
        </div>
        <SkeletonBar className="hidden h-10 max-w-md flex-1 rounded-full lg:block" />
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-9 w-9 rounded-full" />
          <SkeletonBar className="h-9 w-9 rounded-full" />
          <SkeletonBar className="h-9 w-32 rounded-xl" />
        </div>
      </div>
    </header>
  );
}

/** Header công khai (PublicHeader) — dùng cho CMS admin / sales staff. */
function PublicHeaderChrome() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6">
        <SkeletonBar className="h-7 w-24" />
        <nav className="ml-1 hidden flex-1 items-center gap-4 lg:flex">
          {[80, 64, 72, 56, 68].map((w, i) => (
            <SkeletonBar key={i} className="h-3.5" style={{ width: w }} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SkeletonBar className="h-9 w-24 rounded-lg" />
          <SkeletonBar className="h-9 w-9 rounded-full" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Trang skeleton                                                       */
/* ------------------------------------------------------------------ */

/**
 * Đọc role đã cache trong React Query để chọn chrome đúng.
 * Mirror đúng quy tắc phân nhánh của `AppShell`:
 * - Ứng viên            → top nav ứng viên
 * - NTD / CompanyAdmin  → sidebar recruiter
 * - CMS admin / Sale   → header công khai (PublicHeader)
 *
 * `chrome="public"` ép dùng header công khai — dành cho route `allowGuest`
 * (AppShell luôn render PublicHeader cho khách chưa đăng nhập).
 */
function useAdaptiveTone(fallback: Tone, chrome: ChromeMode = 'auto'): Tone {
  const queryClient = useQueryClient();
  if (chrome !== 'auto') return chrome;
  const cached = queryClient.getQueryData<{ role?: UserRole }>(['me']);
  const role = cached?.role;
  if (!role) return fallback;
  if (role === UserRole.Candidate) return 'candidate';
  if (isCmsAdminRole(role) || isSalesStaff(role)) return 'public';
  return 'recruiter';
}

function BodySkeleton({
  cards,
  showHero,
  tone,
}: {
  cards: number;
  showHero: boolean;
  tone: Tone;
}) {
  return (
    <main
      className={clsx(
        'flex-1 px-4 py-6 sm:px-6 lg:px-8',
        tone === 'recruiter' ? 'lg:max-w-none' : 'mx-auto w-full max-w-[1280px]',
      )}
    >
      {showHero ? (
        <div className="brand-hero-surface relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="relative space-y-3">
            <SkeletonBar className="h-3 w-40 bg-white/20" />
            <SkeletonBar className="h-6 w-2/3 bg-white/25" />
            <SkeletonBar className="h-3 w-1/2 bg-white/15" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SkeletonBar className="h-7 w-56" />
          <SkeletonBar className="h-3.5 w-80" />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}

/** Khung chứa chrome + vùng nội dung — dùng chung cho cả 2 kiểu skeleton. */
function SkeletonFrame({ tone, children }: { tone: Tone; children: ReactNode }) {
  const isRecruiter = tone === 'recruiter';
  return (
    <div
      className={clsx(
        'flex min-h-screen flex-col',
        isRecruiter ? 'bg-[#F8FAFC]' : 'bg-[#F5F7FB]',
      )}
      aria-busy="true"
      aria-live="polite"
    >
      {isRecruiter ? <RecruiterSidebarChrome /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {tone === 'recruiter' ? (
          <RecruiterHeaderChrome />
        ) : tone === 'public' ? (
          <PublicHeaderChrome />
        ) : (
          <CandidateHeaderChrome />
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Khung loading đầy đủ cho giao diện ứng viên (top nav) — dùng `loading.tsx`.
 */
export function PageSkeleton({
  tone = 'candidate',
  cards = 3,
  showHero = false,
  chrome = 'auto',
}: {
  tone?: Tone;
  /** Số thẻ skeleton hiển thị. */
  cards?: number;
  /** Bật khối hero (gradient navy) ở trên cùng. */
  showHero?: boolean;
  /** Ép kiểu chrome. `public` cho route `allowGuest` (luôn dùng PublicHeader). */
  chrome?: ChromeMode;
}) {
  const resolved = useAdaptiveTone(tone, chrome);
  return (
    <SkeletonFrame tone={resolved}>
      <BodySkeleton cards={cards} showHero={showHero} tone={resolved} />
    </SkeletonFrame>
  );
}

/**
 * Khung loading dạng danh sách hàng (bảng tin tuyển dụng, danh sách ứng viên).
 */
export function ListSkeleton({
  tone = 'candidate',
  rows = 5,
  chrome = 'auto',
}: {
  tone?: Tone;
  rows?: number;
  /** Ép kiểu chrome. `public` cho route `allowGuest` (luôn dùng PublicHeader). */
  chrome?: ChromeMode;
}) {
  const resolved = useAdaptiveTone(tone, chrome);
  return (
    <SkeletonFrame tone={resolved}>
      <main
        className={clsx(
          'flex-1 px-4 py-6 sm:px-6 lg:px-8',
          resolved === 'recruiter' ? 'lg:max-w-none' : 'mx-auto w-full max-w-[1280px]',
        )}
      >
        <div className="space-y-3">
          <SkeletonBar className="h-7 w-56" />
          <SkeletonBar className="h-3.5 w-80" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(7,35,72,0.04),0_12px_32px_-18px_rgba(7,35,72,0.22)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-slate-200/80" />
                  <div className="h-3 w-1/4 rounded bg-slate-200/70" />
                  <div className="h-2.5 w-2/3 rounded bg-slate-200/60" />
                </div>
                <div className="h-7 w-20 shrink-0 rounded-full bg-slate-200/70" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </SkeletonFrame>
  );
}
