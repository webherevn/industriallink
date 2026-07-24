'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell,
  Briefcase,
  ChevronDown,
  ClipboardList,
  FilePenLine,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UserRole } from '@industriallink/contracts';
import { BrandMark } from '@/components/brand-logo';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileAvatar } from '@/components/profile-avatar';
import { RecruiterShell } from '@/components/recruiter-shell';
import { tokenStore } from '@/lib/api';
import { fetchMe, logout } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';

/** Menu chính — hành trình ứng tuyển (không nhồi tài khoản/thông báo). */
const CANDIDATE_PRIMARY_NAV = [
  { href: '/jobs', label: 'Việc làm', icon: Briefcase },
  { href: '/cv/create', label: 'Tạo CV', icon: FilePenLine },
  { href: '/recommended', label: 'Gợi ý AI', icon: Sparkles },
  { href: '/applications', label: 'Đơn ứng tuyển', icon: ClipboardList },
  { href: '/progress', label: 'Tiến trình', icon: Target },
] as const;

const CANDIDATE_ACCOUNT_LINKS = [
  { href: '/dashboard', label: 'Hồ sơ của tôi', icon: LayoutDashboard },
  { href: '/upload', label: 'Tải / phân tích CV', icon: FileUp },
  { href: '/account', label: 'Tài khoản & bảo mật', icon: Settings2 },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/jobs') {
    return pathname === '/jobs' || pathname.startsWith('/jobs/');
  }
  if (href === '/cv/create') {
    return pathname === '/cv/create' || pathname.startsWith('/cv/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shell ứng viên (top nav) — NTD dùng RecruiterShell sidebar. */
export function AppShell({
  children,
  wide = false,
  flush = false,
  bleed = false,
}: {
  children: ReactNode;
  /** Nội dung rộng hơn (trang Việc làm). */
  wide?: boolean;
  /** Bỏ padding dọc — dùng khi trang có hero full-bleed. */
  flush?: boolean;
  /** Full-bleed ngang (banner trang công ty). */
  bleed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const { data: user, isError, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: typeof window !== 'undefined' && Boolean(tokenStore.get()),
  });

  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    enabled: typeof window !== 'undefined' && Boolean(tokenStore.get()),
    retry: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && !tokenStore.get()) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDocClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  async function onLogout() {
    setAccountOpen(false);
    await logout();
    router.replace('/login');
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-slate-500">
        Đang tải...
      </div>
    );
  }

  if (user.role !== UserRole.Candidate) {
    return <RecruiterShell>{children}</RecruiterShell>;
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex h-14 max-w-[1280px] items-stretch gap-4 px-4 sm:h-16 sm:px-6">
          <BrandMark
            href="/jobs"
            size={32}
            className="self-center"
            wordmarkClassName="hidden sm:inline"
          />

          <nav
            className="ml-1 hidden h-full min-w-0 flex-1 items-stretch gap-0.5 lg:flex"
            aria-label="Menu chính"
          >
            {CANDIDATE_PRIMARY_NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'inline-flex items-center gap-1.5 border-b-2 px-3 text-[13px] font-semibold transition-colors duration-200',
                    active
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900',
                  )}
                >
                  <Icon
                    className={clsx(
                      'h-4 w-4 shrink-0 transition-colors',
                      active ? 'text-brand-500' : 'text-slate-400',
                    )}
                    strokeWidth={1.85}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 self-center sm:gap-1.5">
            <Link
              href="/jobs"
              className="hidden items-center rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 md:inline-flex"
            >
              Tìm việc
            </Link>

            <NotificationBell />

            <div className="relative" ref={accountRef}>
              <button
                type="button"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((v) => !v)}
                className={clsx(
                  'flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors duration-200 sm:pr-2.5',
                  accountOpen
                    ? 'bg-brand-50 ring-1 ring-brand-100'
                    : 'hover:bg-slate-50',
                )}
              >
                <ProfileAvatar
                  displayName={user.displayName || 'UV'}
                  email={user.email}
                  hasAvatar={Boolean(candidate?.hasAvatar)}
                  size="sm"
                  editable={false}
                />
                <span className="hidden max-w-[120px] truncate text-left text-[13px] font-semibold text-slate-700 xl:block">
                  {user.displayName}
                </span>
                <ChevronDown
                  className={clsx(
                    'hidden h-3.5 w-3.5 text-slate-400 transition-transform duration-200 sm:block',
                    accountOpen && 'rotate-180',
                  )}
                />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg shadow-slate-200/60 animate-soft-rise"
                >
                  <div className="border-b border-slate-100 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        displayName={user.displayName || 'UV'}
                        email={user.email}
                        hasAvatar={Boolean(candidate?.hasAvatar)}
                        size="sm"
                        editable={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {user.displayName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <span className="mt-2 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                      Ứng viên
                    </span>
                  </div>
                  <div className="py-1">
                    {CANDIDATE_ACCOUNT_LINKS.map((item) => {
                      const Icon = item.icon;
                      const active = isNavActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          className={clsx(
                            'flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                            active
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            className="border-t border-slate-100 bg-white px-4 py-3 shadow-sm lg:hidden"
            aria-label="Menu mobile"
          >
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Khám phá & theo dõi
            </p>
            <ul className="space-y-0.5">
              {CANDIDATE_PRIMARY_NAV.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Cá nhân
            </p>
            <ul className="space-y-0.5">
              {CANDIDATE_ACCOUNT_LINKS.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/notifications"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                  Trung tâm thông báo
                </Link>
              </li>
            </ul>

            <button
              type="button"
              onClick={onLogout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </nav>
        )}
      </header>

      <main
        className={
          bleed
            ? 'w-full'
            : wide
              ? flush
                ? 'mx-auto max-w-[1280px] px-4 sm:px-6'
                : 'mx-auto max-w-[1280px] px-4 py-6 sm:px-6'
              : 'mx-auto max-w-6xl px-6 py-8'
        }
      >
        {children}
      </main>
    </div>
  );
}
