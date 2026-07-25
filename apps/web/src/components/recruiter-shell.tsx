'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Gift,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Shield,
  Target,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandSidebarLockup } from '@/components/brand-logo';
import { NotificationBell } from '@/components/notification-bell';
import { tokenStore } from '@/lib/api';
import { fetchMe, logout } from '@/lib/auth';
import {
  MY_COMPANY_LOGO_QUERY_KEY,
  fetchMyCompanyLogoObjectUrl,
  getMyCompany,
} from '@/lib/company';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavSection = { title?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/recruiter', label: 'Tổng quan', icon: LayoutDashboard }],
  },
  {
    title: 'Tuyển dụng',
    items: [
      { href: '/jobs/manage', label: 'Tin tuyển dụng', icon: Briefcase },
      { href: '/jobs/new', label: 'AI viết JD', icon: FileText },
      { href: '/recruiter/inbox', label: 'Hộp thư ứng viên', icon: Users },
      { href: '/search', label: 'Tìm ứng viên AI', icon: Target },
      { href: '/company', label: 'Công ty', icon: Building2 },
    ],
  },
  {
    title: 'Quy trình tuyển dụng',
    items: [
      { href: '/recruiter/calendar', label: 'Lịch phỏng vấn', icon: Calendar },
      { href: '/recruiter/offers', label: 'Đề nghị làm việc', icon: Gift },
      { href: '/recruiter/onboarding', label: 'Nhận việc', icon: UserPlus },
    ],
  },
  {
    title: 'Báo cáo',
    items: [
      { href: '#', label: 'Báo cáo tuyển dụng', icon: BarChart3, soon: true },
      { href: '/jobs/new', label: 'Lương thị trường', icon: Wallet },
    ],
  },
  {
    title: 'Tài khoản',
    items: [{ href: '/account', label: 'Bảo mật / MFA', icon: Shield }],
  },
];

function CompanyAvatar({
  logoUrl,
  name,
  sizeClass = 'h-9 w-9',
  textClass = 'text-[11px]',
}: {
  logoUrl: string | null | undefined;
  name: string;
  sizeClass?: string;
  textClass?: string;
}) {
  const initials = name
    .split(' ')
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={clsx(sizeClass, 'rounded-full object-cover ring-2 ring-white')}
      />
    );
  }

  return (
    <div
      className={clsx(
        sizeClass,
        textClass,
        'flex items-center justify-center rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#93C5FD] font-bold text-[#1D4ED8] ring-2 ring-white',
      )}
    >
      {initials || 'NT'}
    </div>
  );
}

export function RecruiterShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const { data: user, isError } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: typeof window !== 'undefined' && Boolean(tokenStore.get()),
  });

  const { data: company } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
    enabled: typeof window !== 'undefined' && Boolean(tokenStore.get()),
    retry: false,
  });

  const { data: logoUrl } = useQuery({
    queryKey: MY_COMPANY_LOGO_QUERY_KEY,
    queryFn: fetchMyCompanyLogoObjectUrl,
    enabled: Boolean(company?.hasLogo),
    staleTime: 5 * 60_000,
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/search');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  async function onLogout() {
    setAccountOpen(false);
    await logout();
    router.replace('/login');
  }

  function isActive(href: string) {
    if (href === '#') return false;
    if (href === '/recruiter') return pathname === '/recruiter';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const displayName = company?.name || user?.displayName || 'Nhà tuyển dụng';

  const sidebar = (
    <aside className="flex h-full w-[260px] flex-col border-r border-slate-200/80 bg-white">
      <div className="px-4 py-5">
        <BrandSidebarLockup href="/recruiter" />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title ?? 'main'}>
            {section.title && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                if (item.soon) {
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-400">
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                          Sắp có
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <CompanyAvatar
            logoUrl={logoUrl}
            name={displayName}
            sizeClass="h-10 w-10"
            textClass="text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {company?.name ?? user?.displayName ?? 'Nhà tuyển dụng'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user?.displayName ?? 'Tài khoản NTD'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="truncate text-[1.25rem] font-bold leading-tight text-slate-900">
                  Xin chào{' '}
                  {user?.displayName
                    ? `Anh ${user.displayName.split(' ').slice(-1)[0]}`
                    : 'bạn'}
                  ! 👋
                </p>
                <p className="mt-1 hidden truncate text-[13px] text-slate-500 sm:block">
                  Trợ lý AI đã sẵn sàng hỗ trợ công việc tuyển dụng của bạn hôm nay.
                </p>
              </div>
            </div>

            <Link
              href="/search"
              className="hidden max-w-lg flex-1 items-center gap-2.5 rounded-full border border-slate-200 bg-[#F1F5F9] px-4 py-2.5 text-[13px] text-slate-400 transition hover:border-blue-200 hover:bg-white lg:flex"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="flex-1 truncate">Tìm kiếm ứng viên, tin tuyển dụng...</span>
              <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                ⌘K
              </kbd>
            </Link>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <NotificationBell />
              <Link
                href="/recruiter/inbox"
                className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Tin nhắn"
                aria-label="Tin nhắn"
              >
                <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <a
                href="mailto:support@industriallink.vn"
                className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Trợ giúp"
                aria-label="Trợ giúp"
              >
                <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
              </a>

              <div ref={accountRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-slate-100"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <CompanyAvatar logoUrl={logoUrl} name={displayName} />
                  <ChevronDown
                    className={clsx(
                      'hidden h-4 w-4 text-slate-400 transition sm:block',
                      accountOpen && 'rotate-180',
                    )}
                  />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {company?.name ?? 'Chưa có công ty'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user?.email ?? user?.displayName}
                      </p>
                    </div>
                    <Link
                      href="/company"
                      role="menuitem"
                      className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Building2 className="h-4 w-4 text-slate-400" />
                      Hồ sơ công ty
                    </Link>
                    <Link
                      href="/account"
                      role="menuitem"
                      className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Shield className="h-4 w-4 text-slate-400" />
                      Tài khoản & bảo mật
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
