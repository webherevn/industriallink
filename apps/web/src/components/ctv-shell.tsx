'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Percent,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
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
import { NotificationBell } from '@/components/notification-bell';
import { ApiError, restoreSession, tokenStore } from '@/lib/api';
import { clearAuthQueryCache, fetchMe, logout } from '@/lib/auth';
import { publicSiteUrl } from '@/lib/hosts';
import { fetchMyKyc } from '@/lib/ctv-kyc';
import type { CrmKycStatus } from '@industriallink/contracts';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Badge đếm gọn, ví dụ "3/30" cho khóa MST. */
  badge?: string;
  /** Trạng thái KYC hiển thị cạnh mục xác thực. */
  kyc?: boolean;
};

type NavSection = { title: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Tổng quan & Công cụ',
    items: [
      { href: '/ctv', label: 'Tổng quan', icon: LayoutDashboard },
      { href: '/ctv/links', label: 'Link & Tài liệu bán hàng', icon: Link2 },
    ],
  },
  {
    title: 'Khách hàng B2B',
    items: [
      { href: '/ctv/tax-locks', label: 'Khóa Mã số thuế', icon: ScrollText, badge: 'taxLocks' },
      { href: '/ctv/referrals', label: 'Khách hàng giới thiệu', icon: Users },
    ],
  },
  {
    title: 'Hoa hồng & Đối soát',
    items: [
      { href: '/ctv/commissions', label: 'Lịch sử hoa hồng', icon: Percent },
      { href: '/ctv/payouts', label: 'Ví & Kỳ chi trả', icon: Wallet },
    ],
  },
  {
    title: 'Tài khoản & Pháp lý',
    items: [
      { href: '/ctv/kyc', label: 'Xác thực CCCD & Ngân hàng', icon: ShieldCheck, kyc: true },
      { href: '/account', label: 'Bảo mật & Tài khoản', icon: Settings2 },
      { href: '/ctv/policy', label: 'Chính sách & Hướng dẫn', icon: CircleHelp },
    ],
  },
];

/** Nhãn + màu của trạng thái KYC. */
export const KYC_STATUS_META: Record<
  CrmKycStatus,
  { label: string; dot: string; chip: string }
> = {
  UNVERIFIED: {
    label: 'Chưa xác thực',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  PENDING: {
    label: 'Chờ duyệt',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  VERIFIED: {
    label: 'Đã xác thực',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  REJECTED: {
    label: 'Từ chối',
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
};

/** Tiêu đề trang theo đường dẫn — dùng cho Topbar. */
const PAGE_TITLES: Array<{ match: (path: string) => boolean; title: string }> = [
  { match: (p) => p === '/ctv' || p === '/ctv/', title: 'Tổng quan' },
  { match: (p) => p.startsWith('/ctv/links'), title: 'Link & Tài liệu bán hàng' },
  { match: (p) => p.startsWith('/ctv/tax-locks'), title: 'Khóa Mã số thuế' },
  { match: (p) => p.startsWith('/ctv/referrals'), title: 'Khách hàng giới thiệu' },
  { match: (p) => p.startsWith('/ctv/commissions'), title: 'Lịch sử hoa hồng' },
  { match: (p) => p.startsWith('/ctv/payouts'), title: 'Ví & Kỳ chi trả' },
  { match: (p) => p.startsWith('/ctv/kyc'), title: 'Xác thực CCCD & Ngân hàng' },
  { match: (p) => p.startsWith('/ctv/policy'), title: 'Chính sách & Hướng dẫn' },
];

function pageTitle(pathname: string): string {
  return PAGE_TITLES.find((entry) => entry.match(pathname))?.title ?? 'Cổng Cộng tác viên';
}

function navMatches(href: string, path: string): boolean {
  if (href === '/ctv') return path === '/ctv' || path === '/ctv/';
  return path === href || path.startsWith(`${href}/`);
}

/**
 * App Shell của Cổng Cộng tác viên (ctv.inlink.vn).
 * Sidebar trái cố định + Topbar gọn + vùng nội dung nền slate-50.
 * Đồng bộ phong cách với tuyendung.inlink.vn.
 */
export function CtvShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(() => Boolean(tokenStore.get()));
  const [copied, setCopied] = useState(false);
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [taxLockCount, setTaxLockCount] = useState<number | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tokenStore.get()) {
      setSessionReady(true);
      return;
    }
    void restoreSession().finally(() => setSessionReady(true));
  }, []);

  const hasToken = sessionReady && Boolean(tokenStore.get());

  const { data: user, isError, isFetching, error } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
  });

  const { data: kyc } = useQuery({
    queryKey: ['ctv-kyc'],
    queryFn: fetchMyKyc,
    enabled: hasToken && Boolean(user),
    retry: false,
    staleTime: 30_000,
  });

  // Số MST đang bảo vệ (X/30) cho badge sidebar.
  const { data: partner } = useQuery({
    queryKey: ['recruiter-partner'],
    queryFn: () => import('@/lib/crm').then((mod) => mod.fetchMyPartner()),
    enabled: hasToken && Boolean(user),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!partner?.partner) return;
    setPartnerCode(partner.partner.code);
    setTaxLockCount(partner.partner.claims.filter((c) => c.status !== 'EXPIRED').length);
  }, [partner]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!tokenStore.get()) router.replace('/login');
  }, [router, sessionReady]);

  useEffect(() => {
    if (!isError) return;
    if (error instanceof ApiError && error.status >= 500) return;
    router.replace('/login');
  }, [error, isError, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function copyCode() {
    if (!partnerCode) return;
    await navigator.clipboard.writeText(partnerCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function onLogout() {
    await logout();
    clearAuthQueryCache(queryClient);
    router.replace('/login');
  }

  if (!sessionReady || (hasToken && !user && isFetching)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Đang tải...
      </div>
    );
  }

  const kycStatus: CrmKycStatus = kyc?.status ?? 'UNVERIFIED';
  const kycMeta = KYC_STATUS_META[kycStatus];
  const displayName = user?.displayName ?? 'Cộng tác viên';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.badge === 'taxLocks' && taxLockCount != null) {
        return { ...item, badge: `${taxLockCount}/30` };
      }
      return item;
    }),
  }));

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <BrandSidebarLockup href={publicSiteUrl()} />
      </div>
      <div className="px-4 pb-4">
        <span className="inline-flex items-center rounded-full bg-[#0F2440] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Cổng CTV · ctv.inlink.vn
        </span>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = navMatches(item.href, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-[#0F2440] font-semibold text-white shadow-sm'
                          : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#E8872A]"
                          aria-hidden
                        />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                            active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                      {item.kyc ? (
                        <span
                          className={clsx(
                            'h-2 w-2 shrink-0 rounded-full',
                            kycMeta.dot,
                            kycStatus === 'PENDING' ? 'animate-pulse' : '',
                          )}
                          title={kycMeta.label}
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Chân sidebar: thẻ tài khoản + trang chủ + đăng xuất */}
      <div className="space-y-2 border-t border-slate-200 bg-slate-50/70 px-3 py-3">
        <div
          ref={accountRef}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2440] text-[11px] font-bold tracking-wider text-white">
              {initials || 'CTV'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-tight text-slate-900">
                {displayName}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-tight text-slate-500">
                <span className="font-mono font-semibold text-slate-600">
                  {partnerCode ?? 'CTV…'}
                </span>
                <span
                  className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', kycMeta.dot)}
                  title={kycMeta.label}
                />
                <span className="truncate">{kycMeta.label}</span>
              </p>
            </div>
          </div>
        </div>
        <a
          href={publicSiteUrl()}
          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
        >
          Trang chủ Inlink
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden shrink-0 self-start lg:sticky lg:top-0 lg:block lg:h-screen">
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
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Mở menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                  {pageTitle(pathname)}
                </h1>
                <span className="mt-0.5 hidden text-[11px] font-medium text-slate-400 sm:block">
                  Cổng Cộng tác viên Inlink
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => void copyCode()}
                disabled={!partnerCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                title="Chép mã CTV của bạn"
              >
                {copied ? (
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden font-mono sm:inline">
                  {partnerCode ?? 'Chép mã CTV'}
                </span>
                <span className="sm:hidden">Mã CTV</span>
              </button>

              <span
                className={clsx(
                  'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 sm:inline-flex',
                  kycMeta.chip,
                )}
                title="Trạng thái xác thực CCCD"
              >
                <span className={clsx('h-1.5 w-1.5 rounded-full', kycMeta.dot)} />
                {kycMeta.label}
              </span>

              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      <CornerRobot name={user?.displayName} />
      <ConnectionChat />
    </div>
  );
}
