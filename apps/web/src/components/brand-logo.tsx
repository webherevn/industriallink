import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

/** Icon vuông iL — dùng trên nav / sidebar. */
export function BrandMark({
  href = '/',
  size = 36,
  showWordmark = true,
  wordmarkClassName,
  className,
}: {
  href?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90',
        className,
      )}
    >
      <Image
        src="/favicon.png"
        alt={BRAND_NAME}
        width={size}
        height={size}
        className="shrink-0 rounded-[22%] shadow-sm"
        priority
      />
      {showWordmark && (
        <span className={clsx('font-bold tracking-tight text-slate-900', wordmarkClassName)}>
          {BRAND_NAME}
        </span>
      )}
    </Link>
  );
}

/** Logo đầy đủ (wordmark + slogan) — trang auth / landing. */
export function BrandLogo({
  href = '/',
  width = 320,
  compact = false,
  className,
}: {
  href?: string;
  width?: number;
  compact?: boolean;
  className?: string;
}) {
  const height = Math.round(width * (313 / 878));
  return (
    <Link href={href} className={clsx('inline-flex shrink-0', className)}>
      <Image
        src="/logo.png"
        alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
        width={width}
        height={height}
        unoptimized
        className={compact ? 'h-10 w-auto sm:h-11' : 'h-auto'}
        style={compact ? undefined : { width }}
        priority
      />
    </Link>
  );
}

/** Sidebar NTD: icon + tên + slogan. */
export function BrandSidebarLockup({ href = '/recruiter' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-start gap-2.5">
      <Image
        src="/favicon.png"
        alt={BRAND_NAME}
        width={36}
        height={36}
        className="mt-0.5 shrink-0 rounded-[22%] shadow-sm"
        priority
      />
      <div>
        <p className="font-bold leading-tight text-slate-900">{BRAND_NAME}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{BRAND_TAGLINE}</p>
      </div>
    </Link>
  );
}

export { BRAND_NAME, BRAND_TAGLINE };
