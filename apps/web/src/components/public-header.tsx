'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Briefcase,
  ChevronDown,
  ClipboardList,
  FilePenLine,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Shield,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthUserView, CmsMenuItemView } from '@industriallink/contracts';
import { CmsMenuLocation, isCmsAdminRole, isSalesStaff, UserRole } from '@industriallink/contracts';
import { BrandLogo } from '@/components/brand-logo';
import { NotificationBell } from '@/components/notification-bell';
import { ProfileAvatar } from '@/components/profile-avatar';
import { getApiBase } from '@/lib/api';
import { goToAdminApp, goToCrmApp, goToRecruiterApp } from '@/lib/hosts';
import { loginHref, safeInternalPath } from '@/lib/safe-next';

export const CREATE_CV_LOGIN_HREF = loginHref('/cv/create');
export const CAREER_GUIDE_PATH = '/cam-nang';

/** Fallback khi chưa cấu hình CMS menu. */
const DEFAULT_PRIMARY_ITEMS: CmsMenuItemView[] = [
  {
    id: 'default-jobs',
    parentId: null,
    label: 'Việc làm',
    url: '/viec-lam',
    sortOrder: 0,
    openInNewTab: false,
    objectType: 'custom',
    objectId: null,
    children: [],
  },
  {
    id: 'default-cv',
    parentId: null,
    label: 'Tạo CV',
    url: CREATE_CV_LOGIN_HREF,
    sortOrder: 1,
    openInNewTab: false,
    objectType: 'custom',
    objectId: null,
    children: [],
  },
  {
    id: 'default-guide',
    parentId: null,
    label: 'Cẩm nang nghề nghiệp',
    url: CAREER_GUIDE_PATH,
    sortOrder: 2,
    openInNewTab: false,
    objectType: 'custom',
    objectId: null,
    children: [],
  },
];

const CANDIDATE_QUICK_LINKS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/profile', label: 'Hồ sơ của tôi', icon: UserRound },
  { href: '/cv/create', label: 'Tạo & Quản lý CV', icon: FilePenLine },
  { href: '/upload', label: 'Tải / phân tích CV', icon: FileUp },
  { href: '/applications', label: 'Đơn ứng tuyển', icon: ClipboardList },
  { href: '/recommended', label: 'Gợi ý việc làm AI', icon: Sparkles },
  { href: '/connections', label: 'Kết nối', icon: Users },
  { href: '/progress', label: 'Tiến trình', icon: Target },
  { href: '/account', label: 'Tài khoản & bảo mật', icon: Settings2 },
] as const;

function menuPathOf(url: string): string {
  try {
    return url.startsWith('http') ? new URL(url).pathname : url.split('?')[0] || '/';
  } catch {
    return url.split('?')[0] || '/';
  }
}

/** Chuẩn hóa URL menu: bỏ ?v=* tạm thời, giữ path sạch cho SEO; nếu đã đăng nhập thì mở thẳng đích của /login?next=... */
function resolveNavHref(url: string, isAuthenticated = false): { href: string; forceDocument: boolean } {
  if (isAuthenticated && url.startsWith('/login?')) {
    try {
      const qs = url.slice('/login?'.length);
      const next = safeInternalPath(new URLSearchParams(qs).get('next'));
      if (next) return { href: next, forceDocument: false };
    } catch {
      // ignore
    }
  }
  const path = menuPathOf(url);
  if (path === CAREER_GUIDE_PATH) {
    return { href: CAREER_GUIDE_PATH, forceDocument: true };
  }
  if (path.startsWith(`${CAREER_GUIDE_PATH}/`)) {
    return { href: path + (url.includes('#') ? `#${url.split('#')[1]}` : ''), forceDocument: false };
  }
  return { href: url, forceDocument: false };
}

function isItemActive(pathname: string, url: string): boolean {
  try {
    const path = menuPathOf(url);
    if (path === '/viec-lam' || path === '/') {
      return pathname === '/' || pathname === '/viec-lam' || pathname.startsWith('/viec-lam/');
    }
    if (path === CAREER_GUIDE_PATH) {
      return pathname === CAREER_GUIDE_PATH || pathname.startsWith(`${CAREER_GUIDE_PATH}/`);
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  } catch {
    return false;
  }
}

async function fetchPrimaryMenu(): Promise<CmsMenuItemView[]> {
  const res = await fetch(`${getApiBase()}/cms/menus/${CmsMenuLocation.Primary}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return DEFAULT_PRIMARY_ITEMS;
  const data = (await res.json()) as { items?: CmsMenuItemView[] };
  if (!data.items?.length) return DEFAULT_PRIMARY_ITEMS;
  return data.items;
}

function NavLink({
  item,
  pathname,
  isAuthenticated,
  onNavigate,
  className,
}: {
  item: CmsMenuItemView;
  pathname: string;
  isAuthenticated?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = isItemActive(pathname, item.url);
  const { href, forceDocument } = resolveNavHref(item.url, isAuthenticated);
  const external = item.url.startsWith('http') || item.openInNewTab || forceDocument;
  const shared = clsx(className, active && 'text-brand-600');

  if (external) {
    return (
      <a
        href={href}
        target={item.openInNewTab || item.url.startsWith('http') ? '_blank' : undefined}
        rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
        onClick={onNavigate}
        className={shared}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onNavigate} className={shared} prefetch={false}>
      {item.label}
    </Link>
  );
}

export function PublicHeader({
  user,
  candidate,
  onLogout,
}: {
  user?: AuthUserView | null;
  candidate?: { hasAvatar?: boolean | null } | null;
  onLogout?: () => void | Promise<void>;
} = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const { data: menuItems = DEFAULT_PRIMARY_ITEMS } = useQuery({
    queryKey: ['public-cms-menu', CmsMenuLocation.Primary],
    queryFn: fetchPrimaryMenu,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const items = useMemo(
    () => (menuItems.length ? menuItems : DEFAULT_PRIMARY_ITEMS),
    [menuItems],
  );

  useEffect(() => {
    setOpen(false);
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

  const isCandidate = user?.role === UserRole.Candidate;
  const isAdmin = user ? isCmsAdminRole(user.role) : false;
  const isCrm = user ? isSalesStaff(user.role) : false;
  const isRecruiter = Boolean(user && !isCandidate && !isAdmin && !isCrm);

  function renderWorkspaceAction() {
    if (!user) return null;
    if (isCandidate) {
      return (
        <Link
          href="/dashboard"
          className="hidden items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:inline-flex"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Quản lý hồ sơ
        </Link>
      );
    }
    if (isRecruiter) {
      return (
        <button
          type="button"
          onClick={() => goToRecruiterApp('/recruiter')}
          className="hidden items-center gap-1.5 rounded-lg bg-[#072348] px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#0c3163] sm:inline-flex"
        >
          <Briefcase className="h-3.5 w-3.5" />
          Bàn làm việc NTD
        </button>
      );
    }
    if (isAdmin) {
      return (
        <button
          type="button"
          onClick={() => goToAdminApp('/admin')}
          className="hidden items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex"
        >
          <Shield className="h-3.5 w-3.5" />
          Quản trị Admin
        </button>
      );
    }
    if (isCrm) {
      return (
        <button
          type="button"
          onClick={() => goToCrmApp('/crm')}
          className="hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:inline-flex"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Bàn làm việc CRM
        </button>
      );
    }
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-stretch gap-3 px-4 sm:h-16 sm:px-6">
        <BrandLogo href="/" compact className="self-center" />

        <nav
          className="ml-1 hidden h-full min-w-0 flex-1 items-stretch gap-0.5 md:flex"
          aria-label="Menu công khai"
        >
          {items.map((item) => {
            const active = isItemActive(pathname, item.url);
            return (
              <div key={item.id} className="group relative flex items-stretch">
                <NavLink
                  item={item}
                  pathname={pathname}
                  isAuthenticated={Boolean(user)}
                  className={clsx(
                    'inline-flex items-center border-b-2 px-3 text-[13px] font-semibold transition-colors',
                    active
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900',
                  )}
                />
                {item.children?.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.id}
                        item={child}
                        pathname={pathname}
                        isAuthenticated={Boolean(user)}
                        className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 self-center sm:gap-2">
          {!user ? (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 hover:text-slate-900 sm:inline-flex"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
              >
                Đăng ký
              </Link>
            </>
          ) : (
            <>
              {renderWorkspaceAction()}
              {isCandidate ? <NotificationBell /> : null}
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  onClick={() => setAccountOpen((v) => !v)}
                  className={clsx(
                    'flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors duration-200 sm:pr-2.5',
                    accountOpen ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-slate-50',
                  )}
                >
                  <ProfileAvatar
                    displayName={user.displayName || 'IL'}
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
                          displayName={user.displayName || 'IL'}
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
                        {isCandidate
                          ? 'Ứng viên'
                          : isRecruiter
                            ? 'Nhà tuyển dụng'
                            : isAdmin
                              ? 'Quản trị viên'
                              : 'CRM / Sales'}
                      </span>
                    </div>

                    <div className="py-1">
                      {isCandidate &&
                        CANDIDATE_QUICK_LINKS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Icon className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                              {item.label}
                            </Link>
                          );
                        })}

                      {isRecruiter && (
                        <>
                          <button
                            type="button"
                            onClick={() => goToRecruiterApp('/recruiter')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-400" />
                            Tổng quan Nhà tuyển dụng
                          </button>
                          <button
                            type="button"
                            onClick={() => goToRecruiterApp('/jobs/manage')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
                            Quản lý tin tuyển dụng
                          </button>
                          <button
                            type="button"
                            onClick={() => goToRecruiterApp('/company')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                            Hồ sơ công ty
                          </button>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => goToAdminApp('/admin')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Shield className="h-4 w-4 shrink-0 text-slate-400" />
                            Vào trang Quản trị Admin
                          </button>
                          <button
                            type="button"
                            onClick={() => goToCrmApp('/crm')}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-400" />
                            Vào trang CRM
                          </button>
                        </>
                      )}

                      {isCrm && (
                        <button
                          type="button"
                          onClick={() => goToCrmApp('/crm')}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-400" />
                          Vào Bàn làm việc CRM
                        </button>
                      )}
                    </div>

                    {onLogout && (
                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void onLogout()}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" strokeWidth={1.75} />
                          Đăng xuất
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden" aria-label="Menu mobile">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  isAuthenticated={Boolean(user)}
                  onNavigate={() => setOpen(false)}
                  className={clsx(
                    'block rounded-xl px-3 py-2.5 text-sm font-semibold',
                    isItemActive(pathname, item.url)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50',
                  )}
                />
                {item.children?.map((child) => (
                  <NavLink
                    key={child.id}
                    item={child}
                    pathname={pathname}
                    isAuthenticated={Boolean(user)}
                    onNavigate={() => setOpen(false)}
                    className="ml-3 block rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                  />
                ))}
              </li>
            ))}
            {!user ? (
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Đăng nhập
                </Link>
              </li>
            ) : (
              <>
                {isCandidate && (
                  <li>
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      Quản lý hồ sơ ứng viên
                    </Link>
                  </li>
                )}
                {isRecruiter && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        goToRecruiterApp('/recruiter');
                      }}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      Bàn làm việc NTD
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
