'use client';

import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { loginHref } from '@/lib/safe-next';

export const CREATE_CV_LOGIN_HREF = loginHref('/cv/create');
export const CAREER_GUIDE_PATH = '/cam-nang';

const GUEST_NAV = [
  {
    href: '/viec-lam',
    label: 'Việc làm',
    active: (path: string) => path === '/' || path === '/viec-lam' || path.startsWith('/viec-lam/'),
  },
  {
    href: CREATE_CV_LOGIN_HREF,
    label: 'Tạo CV',
    active: () => false,
  },
  {
    href: CAREER_GUIDE_PATH,
    label: 'Cẩm nang nghề nghiệp',
    active: (path: string) => path === CAREER_GUIDE_PATH || path.startsWith(`${CAREER_GUIDE_PATH}/`),
  },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-stretch gap-3 px-4 sm:h-16 sm:px-6">
        <BrandLogo href="/" compact className="self-center" />

        <nav
          className="ml-1 hidden h-full min-w-0 flex-1 items-stretch gap-0.5 md:flex"
          aria-label="Menu công khai"
        >
          {GUEST_NAV.map((item) => {
            const active = item.active(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  'inline-flex items-center border-b-2 px-3 text-[13px] font-semibold transition-colors',
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
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
            {GUEST_NAV.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'block rounded-xl px-3 py-2.5 text-sm font-semibold',
                    item.active(pathname) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {item.label}
                </Link>
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
