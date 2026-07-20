import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';

const BRAND_NAME = 'iLink';
const BRAND_TAGLINE = 'Kết nối nhân tài – Dẫn lối công nghiệp';

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
  width = 220,
  className,
}: {
  href?: string;
  width?: number;
  className?: string;
}) {
  const height = Math.round(width * 0.55);
  return (
    <Link href={href} className={clsx('inline-block', className)}>
      <Image
        src="/logo.png"
        alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
        width={width}
        height={height}
        className="h-auto w-full max-w-full rounded-xl"
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
