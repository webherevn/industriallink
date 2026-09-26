'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CmsMenuItemView } from '@industriallink/contracts';
import { CmsMenuLocation } from '@industriallink/contracts';
import { BrandLogo } from '@/components/brand-logo';
import { getApiBase } from '@/lib/api';
import { loginHref } from '@/lib/safe-next';

export const CREATE_CV_LOGIN_HREF = loginHref('/cv/create');
export const CAREER_GUIDE_PATH = '/cam-nang';
/** Query bust HTML cache cũ (trình duyệt từng giữ bản s-maxage=1 năm). */
export const CAREER_GUIDE_HREF = '/cam-nang?v=2';

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
    url: CAREER_GUIDE_HREF,
    sortOrder: 2,
    openInNewTab: false,
    objectType: 'custom',
    objectId: null,
    children: [],
  },
];

function menuPathOf(url: string): string {
  try {
    return url.startsWith('http') ? new URL(url).pathname : url.split('?')[0] || '/';
  } catch {
    return url.split('?')[0] || '/';
  }
}

/** Cẩm nang: full document load + cache-bust (tránh Router Cache / HTML disk cache). */
function resolveNavHref(url: string): { href: string; forceDocument: boolean } {
  const path = menuPathOf(url);
  if (path === CAREER_GUIDE_PATH || path.startsWith(`${CAREER_GUIDE_PATH}/`)) {
    if (path === CAREER_GUIDE_PATH && !url.includes('?')) {
      return { href: CAREER_GUIDE_HREF, forceDocument: true };
    }
    return { href: url, forceDocument: true };
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
  onNavigate,
  className,
}: {
  item: CmsMenuItemView;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = isItemActive(pathname, item.url);
  const { href, forceDocument } = resolveNavHref(item.url);
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

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
                        className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 self-center sm:gap-2">
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
                    onNavigate={() => setOpen(false)}
                    className="ml-3 block rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                  />
                ))}
              </li>
            ))}
            <li>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đăng nhập
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
