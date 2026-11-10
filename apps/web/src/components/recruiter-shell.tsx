'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BarChart3,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  Coins,
  Crosshair,
  Crown,
  FileText,
  Gift,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandSidebarLockup } from '@/components/brand-logo';
import { ConnectionChat } from '@/components/connection-chat';
import { CornerRobot } from '@/components/corner-robot';
import { RecruiterGuide } from '@/components/recruiter-guide';
import { CreditBalanceBadge } from '@/components/credit-balance-badge';
import { NotificationBell } from '@/components/notification-bell';
import { restoreSession, tokenStore, ApiError } from '@/lib/api';
import { clearAuthQueryCache, fetchMe, logout } from '@/lib/auth';
import { bounceIfWrongHost } from '@/lib/hosts';
import {
  MY_COMPANY_LOGO_QUERY_KEY,
  fetchMyCompanyLogoObjectUrl,
  getMyCompany,
} from '@/lib/company';
import { fetchRecruiterEntitlements } from '@/lib/recruiter-billing';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavSection = { title?: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/recruiter', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/recruiter/sourcing', label: 'Săn nhân sự', icon: Crosshair },
    ],
  },
  {
    title: 'Nguồn & Tin tuyển dụng',
    items: [
      { href: '/jobs/manage', label: 'Tin tuyển dụng', icon: Briefcase },
      { href: '/jobs/new', label: 'AI viết JD', icon: FileText },
      { href: '/search', label: 'Tìm ứng viên AI', icon: Target },
    ],
  },
  {
    title: 'Ứng viên & Quy trình',
    items: [
      { href: '/recruiter/inbox', label: 'Hộp thư ứng viên', icon: Users },
      { href: '/recruiter/chat', label: 'Tin nhắn (Chat)', icon: MessageCircle },
      { href: '/recruiter/email', label: 'Gửi email hàng loạt', icon: Mail },
      { href: '/recruiter/calendar', label: 'Lịch phỏng vấn', icon: Calendar },
      { href: '/recruiter/offers', label: 'Đề nghị làm việc', icon: Gift },
      { href: '/recruiter/onboarding', label: 'Nhận việc', icon: UserPlus },
    ],
  },
  {
    title: 'Phân tích & Thị trường',
    items: [
      { href: '/recruiter/report', label: 'Báo cáo tuyển dụng', icon: BarChart3 },
      { href: '/recruiter/salary', label: 'Lương thị trường', icon: TrendingUp },
    ],
  },
  {
    title: 'Doanh nghiệp & Tài khoản',
    items: [
      { href: '/company', label: 'Hồ sơ công ty', icon: Building2 },
      { href: '/recruiter/billing', label: 'Gói dịch vụ & Ví Credit', icon: Wallet },
      { href: '/recruiter/pricing', label: 'Bảng giá nâng cấp', icon: Banknote },
      { href: '/recruiter/billing/credits', label: 'Lịch sử Credit', icon: Coins },
      { href: '/recruiter/partner', label: 'Cộng tác viên', icon: Link2 },
      { href: '/account', label: 'Bảo mật / MFA', icon: Shield },
    ],
  },
];

const PLAN_VISUAL: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  KHAM_PHA: { icon: Sparkles, tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  TIN_DANG: { icon: Megaphone, tone: 'bg-amber-50 text-amber-900 ring-amber-200' },
  TIN_DANG_PLUS: { icon: Star, tone: 'bg-orange-50 text-orange-900 ring-orange-200' },
  DOANH_NGHIEP: { icon: Building2, tone: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  ENTERPRISE: { icon: Crown, tone: 'bg-violet-50 text-violet-900 ring-violet-200' },
  SAN_CO_BAN: { icon: Shield, tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
  SAN_TIEU_CHUAN: { icon: Shield, tone: 'bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200' },
  SAN_CHUYEN_SAU: { icon: Shield, tone: 'bg-indigo-50 text-indigo-900 ring-indigo-200' },
};

const GUIDE_TARGET: Record<string, string> = {
  '/recruiter': 'nav-overview',
  '/jobs/manage': 'nav-jobs',
  '/jobs/new': 'nav-jd',
  '/recruiter/inbox': 'nav-inbox',
  '/search': 'nav-search',
  '/recruiter/calendar': 'nav-calendar',
  '/recruiter/offers': 'nav-offer',
  '/recruiter/onboarding': 'nav-hire',
};

function navMatches(href: string, path: string) {
  if (href === '#') return false;
  if (href === '/recruiter') return path === '/recruiter';
  return path === href || path.startsWith(`${href}/`);
}

function PlanChip({
  code,
  name,
  compact = false,
}: {
  code: string | null | undefined;
  name: string | null | undefined;
  compact?: boolean;
}) {
  const visual = (code && PLAN_VISUAL[code]) || {
    icon: Package,
    tone: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  const Icon = visual.icon;
  return (
    <span
      className={clsx(
        'inline-flex max-w-full items-center gap-1 rounded-full font-bold ring-1',
        compact ? 'px-1.5 py-0.5 text-[10px] leading-none' : 'px-2 py-0.5 text-[11px]',
        visual.tone,
      )}
      title={name ?? 'Chưa gán gói'}
    >
      <Icon className={compact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} />
      <span className="truncate">{name ?? 'Chưa gán gói'}</span>
    </span>
  );
}

function AccountPlanChips({
  planCode,
  planName,
  sourcingCode,
  sourcingName,
  compact = false,
}: {
  planCode: string | null | undefined;
  planName: string | null | undefined;
  sourcingCode: string | null | undefined;
  sourcingName: string | null | undefined;
  compact?: boolean;
}) {
  return (
    <span className="flex max-w-full flex-wrap items-center gap-1">
      <PlanChip code={planCode} name={planName} compact={compact} />
      {sourcingName ? (
        <PlanChip code={sourcingCode} name={sourcingName} compact={compact} />
      ) : null}
    </span>
  );
}

function CompanyAvatar({
  logoUrl,
  name,
  sizeClass = 'h-9 w-9',
  textClass = 'text-[11px]',
  shapeClass = 'rounded-full',
}: {
  logoUrl: string | null | undefined;
  name: string;
  sizeClass?: string;
  textClass?: string;
  shapeClass?: string;
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
        className={clsx(sizeClass, shapeClass, 'object-cover ring-2 ring-white shadow-2xs')}
      />
    );
  }

  return (
    <div
      className={clsx(
        sizeClass,
        textClass,
        shapeClass,
        'flex items-center justify-center bg-gradient-to-br from-[#072348] via-[#0c3266] to-[#1E40AF] font-bold text-white shadow-2xs ring-2 ring-white',
      )}
    >
      {initials || 'NT'}
    </div>
  );
}

let savedSidebarScrollTop = 0;

export function RecruiterShell({
  children,
  pinSidebar = true,
}: {
  children: ReactNode;
  /** Sidebar đứng yên khi cuộn nội dung trang (mặc định: true). */
  pinSidebar?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(() => Boolean(tokenStore.get()));
  const accountRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (tokenStore.get()) {
      setSessionReady(true);
      return;
    }
    void restoreSession().finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (navRef.current && savedSidebarScrollTop > 0) {
      navRef.current.scrollTop = savedSidebarScrollTop;
    }
  }, [pathname, sessionReady]);

  useEffect(() => {
    const openNav = () => setMobileOpen(true);
    window.addEventListener('inlink-guide-open-nav', openNav);
    return () => window.removeEventListener('inlink-guide-open-nav', openNav);
  }, []);

  const hasToken = sessionReady && Boolean(tokenStore.get());

  const {
    data: user,
    isError,
    isFetching: meFetching,
    error: meError,
    refetch: refetchMe,
  } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 429) return count < 2;
      return false;
    },
    retryDelay: (n) => Math.min(1500 * 2 ** n, 6000),
  });

  const { data: company } = useQuery({
    queryKey: ['my-company', user?.id ?? 'anon'],
    queryFn: getMyCompany,
    enabled: hasToken && Boolean(user?.id),
    retry: false,
  });

  const { data: logoUrl } = useQuery({
    queryKey: MY_COMPANY_LOGO_QUERY_KEY,
    queryFn: fetchMyCompanyLogoObjectUrl,
    enabled: Boolean(company?.hasLogo),
    staleTime: 5 * 60_000,
  });

  const { data: entitlements } = useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
    enabled: hasToken && Boolean(user?.id),
    staleTime: 30_000,
    retry: false,
  });
  const planCode = entitlements?.planCode ?? entitlements?.plan?.planCode ?? null;
  const planName = entitlements?.planName ?? entitlements?.plan?.planName ?? null;
  const sourcing = entitlements?.sourcing;
  const sourcingCode = sourcing?.assignment?.isActive ? sourcing.planCode : null;
  const sourcingName = sourcing?.assignment?.isActive ? sourcing.planName : null;

  const meRateLimited =
    isError && meError instanceof ApiError && meError.status === 429;
  const meServerError =
    isError && meError instanceof ApiError && meError.status >= 500;

  useEffect(() => {
    if (!sessionReady) return;
    if (!tokenStore.get()) {
      router.replace('/login');
    }
  }, [router, sessionReady]);

  useEffect(() => {
    if (!isError) return;
    // 429 / 5xx: không đá về login (tránh nhảy vòng)
    if (meRateLimited || meServerError) return;
    router.replace('/login');
  }, [isError, meRateLimited, meServerError, router]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    bounceIfWrongHost(user.role, `${window.location.pathname}${window.location.search}`);
  }, [user]);

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
    clearAuthQueryCache(queryClient);
    router.replace('/login');
  }

  function isActive(href: string) {
    if (!navMatches(href, pathname)) return false;
    const winner = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.href))
      .filter((itemHref) => navMatches(itemHref, pathname))
      .sort((a, b) => b.length - a.length)[0];
    return href === winner;
  }

  if (!sessionReady || (hasToken && !user && meFetching)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-slate-500">
        Đang tải...
      </div>
    );
  }

  if (hasToken && !user && (meRateLimited || meServerError)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F8FAFC] px-6 text-center">
        <p className="text-sm text-slate-600">
          {meRateLimited
            ? 'Máy chủ đang giới hạn truy cập (quá nhiều request). Đợi vài giây rồi thử lại.'
            : 'Không kết nối được máy chủ. Thử lại sau.'}
        </p>
        <button
          type="button"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          onClick={() => void refetchMe()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  const displayName = company?.name || user?.displayName || 'Nhà tuyển dụng';

  const sidebar = (
    <aside className="flex h-full w-[260px] flex-col border-r border-slate-200/80 bg-white">
      <div className="px-4 py-5">
        <BrandSidebarLockup href="/recruiter" />
      </div>

      <nav
        ref={navRef}
        onScroll={(e) => {
          savedSidebarScrollTop = e.currentTarget.scrollTop;
        }}
        className="flex-1 space-y-4 overflow-y-auto px-3 pb-4"
      >
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
                if (item.href === '/recruiter/sourcing') {
                  const hasActiveSourcing = Boolean(sourcingName);
                  return (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        data-guide={GUIDE_TARGET[item.href]}
                        className={clsx(
                          'group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg px-2.5 py-[7px] text-sm transition-all duration-300',
                          active
                            ? 'bg-gradient-to-r from-[#072348] via-[#0c3266] to-[#133f7d] font-semibold text-white shadow-sm ring-1 ring-[#E8872A]/60'
                            : 'border border-[#F7CFA8]/90 bg-gradient-to-r from-[#FFF8F1] via-[#FFF4E8] to-amber-50/70 font-semibold text-[#072348] hover:translate-x-0.5 hover:border-[#E8872A] hover:from-[#FFF3E6] hover:via-[#FFEAD5] hover:to-amber-100/80 hover:shadow-xs',
                        )}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[380%]"
                        />
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-300 to-[#E8872A]"
                            aria-hidden
                          />
                        )}
                        <span className="relative flex min-w-0 items-center gap-2">
                          <span
                            className={clsx(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all duration-300',
                              active
                                ? 'bg-gradient-to-br from-amber-400 to-[#E8872A] text-white shadow-2xs'
                                : 'bg-[#E8872A]/15 text-[#E8872A] ring-1 ring-[#E8872A]/25 group-hover:bg-[#E8872A] group-hover:text-white',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {hasActiveSourcing ? (
                          <span
                            className={clsx(
                              'relative inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none',
                              active
                                ? 'bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
                            )}
                          >
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            </span>
                            LIVE
                          </span>
                        ) : (
                          <span
                            className={clsx(
                              'relative inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none transition-transform duration-300 group-hover:scale-105',
                              active
                                ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/40'
                                : 'bg-gradient-to-r from-[#E8872A] to-amber-500 text-white',
                            )}
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            AI VIP
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                }
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
                      data-guide={GUIDE_TARGET[item.href]}
                      className={clsx(
                        'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-400"
                          aria-hidden
                        />
                      )}
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

      <div className="px-3 pb-2.5">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('inlink-open-guide'))}
          className="flex w-full items-center gap-2.5 rounded-lg border border-amber-200/90 bg-amber-50/80 px-2.5 py-2 text-sm font-semibold text-[#072348] transition hover:border-amber-300 hover:bg-amber-100/80"
        >
          <HelpCircle className="h-4 w-4 text-[#E8872A]" />
          Hướng dẫn sử dụng
        </button>
      </div>

      <div className="border-t border-slate-200/70 bg-gradient-to-b from-slate-50/50 to-slate-100/60 p-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(7,35,72,0.08)]">
          <div className="flex items-center gap-2.5">
            <Link
              href="/company"
              className="relative shrink-0 transition-transform hover:scale-105"
              title="Hồ sơ công ty"
            >
              <CompanyAvatar
                logoUrl={logoUrl}
                name={displayName}
                sizeClass="h-10 w-10"
                textClass="text-xs tracking-wider"
                shapeClass="rounded-xl"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                title="Đang hoạt động"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href="/company"
                className="block truncate text-[13px] font-bold text-[#072348] transition hover:text-brand-600"
              >
                {company?.name ?? user?.displayName ?? 'Nhà tuyển dụng'}
              </Link>
              <p className="truncate text-[11px] font-medium text-slate-400">
                {user?.email ?? 'Tài khoản doanh nghiệp'}
              </p>
            </div>
          </div>

          <Link
            href="/recruiter/billing"
            className="mt-2.5 flex flex-wrap items-center gap-1 rounded-lg bg-slate-50/90 px-2 py-1.5 ring-1 ring-slate-200/60 transition hover:bg-slate-100/80"
            title="Xem gói dịch vụ & Ví Credit"
          >
            <AccountPlanChips
              planCode={planCode}
              planName={planName}
              sourcingCode={sourcingCode}
              sourcingName={sourcingName}
              compact
            />
          </Link>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2.5">
            <Link
              href="/company"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-[#072348]"
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Hồ sơ CTy
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200/70 bg-rose-50/50 px-2 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <div
        className={clsx(
          'hidden lg:block',
          pinSidebar && 'sticky top-0 h-screen shrink-0 self-start',
        )}
      >
        {sidebar}
      </div>

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
                  {user?.displayName?.split(' ').slice(-1)[0] || 'bạn'}
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
              <CreditBalanceBadge />
              <NotificationBell />
              <Link
                href="/recruiter/inbox"
                className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Tin nhắn"
                aria-label="Tin nhắn"
              >
                <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('inlink-open-guide'))}
                className="rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Hướng dẫn"
                aria-label="Hướng dẫn"
              >
                <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
              </button>

              <div ref={accountRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex max-w-[280px] items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 transition hover:bg-slate-100"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <CompanyAvatar logoUrl={logoUrl} name={displayName} />
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block truncate text-sm font-semibold leading-tight text-slate-900">
                      {company?.name ?? 'Công ty'}
                    </span>
                    <span className="mt-0.5 block">
                      <AccountPlanChips
                        planCode={planCode}
                        planName={planName}
                        sourcingCode={sourcingCode}
                        sourcingName={sourcingName}
                        compact
                      />
                    </span>
                  </span>
                  <ChevronDown
                    className={clsx(
                      'hidden h-4 w-4 shrink-0 text-slate-400 transition sm:block',
                      accountOpen && 'rotate-180',
                    )}
                  />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
                  >
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {company?.name ?? 'Chưa có công ty'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user?.email ?? user?.displayName}
                      </p>
                      <div className="mt-2">
                        <AccountPlanChips
                          planCode={planCode}
                          planName={planName}
                          sourcingCode={sourcingCode}
                          sourcingName={sourcingName}
                        />
                      </div>
                    </div>
                    <Link
                      href="/recruiter/billing"
                      role="menuitem"
                      className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Wallet className="h-4 w-4 text-slate-400" />
                      Gói & Credit
                    </Link>
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
      <RecruiterGuide />
      <CornerRobot name={user?.displayName} />
      <ConnectionChat />
    </div>
  );
}
