'use client';

import {
  cloneDefaultStructuredFooter,
  normalizeStructuredFooter,
  type CmsFooterLink,
  type CmsFooterSettingsView,
  type CmsFooterSocial,
  type CmsStructuredFooter,
} from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand-logo';
import { getApiBase } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

async function fetchFooterClient(): Promise<CmsFooterSettingsView | null> {
  const res = await fetch(`${getApiBase()}/cms/footer`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as CmsFooterSettingsView;
}

function SocialGlyph({ platform }: { platform: CmsFooterSocial['platform'] }) {
  if (platform === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.5H7.5v3.2h2.7V21h3.3Z" />
      </svg>
    );
  }
  if (platform === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M6.9 8.5H3.6V20h3.3V8.5ZM5.2 3.3a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM20.4 13.2c0-3.2-1.7-5-4.4-5-1.6 0-2.6.9-3 1.7V8.5H9.8V20h3.3v-6.1c0-1.6.3-3.1 2.2-3.1 1.9 0 1.9 1.8 1.9 3.2V20h3.2v-6.8Z" />
      </svg>
    );
  }
  if (platform === 'threads') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M12.2 3C7.2 3 3.8 6.4 3.8 12s3.4 9 8.4 9c3 0 5.3-1.1 6.8-3.1l-1.5-1.1c-1.2 1.5-2.9 2.3-5.2 2.3-3.9 0-6.5-2.7-6.5-7.1s2.6-7.1 6.4-7.1c3.3 0 5.6 2 5.9 5.2-.6-.4-1.4-.7-2.4-.9-.5-2.1-1.9-3.3-3.9-3.3-2.5 0-4.3 1.8-4.3 4.2 0 2.3 1.6 3.9 3.9 3.9 1.5 0 2.7-.6 3.4-1.7.3.6.8 1.1 1.6 1.1 1.7 0 2.8-1.5 2.8-3.8C19.2 6.2 16.4 3 12.2 3Zm-.5 10.9c-1.3 0-2.1-.8-2.1-2s.9-2.2 2.2-2.2c1.2 0 2 .7 2.2 1.9-.2 1.4-1.1 2.3-2.3 2.3Z" />
      </svg>
    );
  }
  if (platform === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M16.6 5.8A4.8 4.8 0 0 1 15.2 3h-3v12.1a2.4 2.4 0 1 1-1.7-2.3V9.7a5.4 5.4 0 1 0 4.7 5.4V9.4a7.7 7.7 0 0 0 4.5 1.5V7.9a4.8 4.8 0 0 1-3.1-2.1Z" />
      </svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.1V8.9l5.2 3.1L10 15.1Z" />
      </svg>
    );
  }
  return <ExternalLink className="h-3.5 w-3.5" aria-hidden />;
}

function FooterNavLink({ link, className }: { link: CmsFooterLink; className?: string }) {
  const rawHref = link.href.trim();
  const href = rawHref === '/cv' ? '/cv/create' : rawHref;
  const isExternal = Boolean(link.external || /^https?:\/\//i.test(href));
  const isCrossSubdomainRedirect = /^\/(bang-gia|company)(\b|#|\?|\/|$)/i.test(href);
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {link.label}
      </a>
    );
  }
  if (isCrossSubdomainRedirect) {
    return (
      <a href={href} className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {link.label}
    </Link>
  );
}

/** Chân trang public chuẩn nền tảng tuyển dụng B2B — quản trị trực tiếp từ /admin/cms/footer. */
export function SiteFooter() {
  const { data } = useQuery({
    queryKey: ['public-cms-footer'],
    queryFn: fetchFooterClient,
    staleTime: 60_000,
  });

  const footer: CmsStructuredFooter = data?.structured
    ? normalizeStructuredFooter(data.structured)
    : cloneDefaultStructuredFooter();

  const copyright =
    data?.copyrightText?.trim() ||
    `©${new Date().getFullYear()} Inlink Vietnam JSC. All rights reserved.`;

  const bctImg = resolveCmsAssetUrl(footer.bctBadgeImageUrl);
  const visibleColumns = footer.columns.filter((c) => c.title.trim() && c.links.length > 0);

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#072348] text-slate-300">
      {/* Tầng 1: 5 cột thương hiệu, liên hệ & điều hướng */}
      <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-12 sm:px-6 lg:pt-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.55fr_1fr_1fr_1fr_1.15fr] lg:gap-8">
          {/* Cột 1: Thương hiệu, Liên hệ & Social */}
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandMark size={36} wordmarkClassName="text-xl font-extrabold text-white" />
            {footer.slogan ? (
              <p className="mt-3.5 max-w-xs text-[13.5px] leading-relaxed text-slate-300/90">
                {footer.slogan}
              </p>
            ) : null}

            <div className="mt-5 space-y-2.5 text-[13px]">
              {footer.email ? (
                <a
                  href={`mailto:${footer.email}`}
                  className="flex items-center gap-2.5 text-slate-200 transition hover:text-[#FFB366]"
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#E8872A]" />
                  <span>{footer.email}</span>
                </a>
              ) : null}

              {footer.hotline ? (
                <a
                  href={`tel:${footer.hotline.replace(/[^\d+]/g, '')}`}
                  className="flex items-center gap-2.5 text-slate-200 transition hover:text-[#FFB366]"
                >
                  <Phone className="h-4 w-4 shrink-0 text-[#E8872A]" />
                  <span className="font-semibold">{footer.hotline}</span>
                </a>
              ) : null}
            </div>

            {footer.zaloUrl ? (
              <div className="mt-4">
                <a
                  href={footer.zaloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-[#E8872A] hover:ring-[#E8872A]"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{footer.zaloLabel || 'Zalo hỗ trợ ứng viên'}</span>
                </a>
              </div>
            ) : null}

            {footer.socials.length > 0 ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Kết nối với {BRAND_NAME}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {footer.socials.map((s, idx) =>
                    s.href ? (
                      <a
                        key={`${s.platform}-${idx}`}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.label}
                        aria-label={s.label}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07] text-slate-200 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-[#E8872A] hover:text-white hover:ring-[#E8872A]"
                      >
                        <SocialGlyph platform={s.platform} />
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Các cột điều hướng (Về inLink · Ứng viên · Doanh nghiệp · Chính sách) */}
          {visibleColumns.map((col, colIdx) => (
            <div key={`${col.title}-${colIdx}`}>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-white">
                {col.title}
              </h3>
              <span className="mt-2 block h-[2px] w-7 rounded-full bg-[#E8872A]" aria-hidden />
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link, linkIdx) => (
                  <li key={`${link.label}-${linkIdx}`}>
                    <FooterNavLink
                      link={link}
                      className="text-[13px] leading-snug text-slate-300 transition hover:text-[#FFB366]"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Tầng 2: Thông tin pháp lý doanh nghiệp & Chứng nhận */}
        <div className="mt-10 flex flex-col gap-5 border-t border-white/10 pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 text-xs leading-relaxed text-slate-300/90">
            {footer.companyName ? (
              <p className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-white">
                <Building2 className="h-4 w-4 shrink-0 text-[#E8872A]" />
                <span>{footer.companyName}</span>
              </p>
            ) : null}
            {footer.address ? (
              <p className="flex items-start gap-2 text-slate-300/85">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>Trụ sở: {footer.address}</span>
              </p>
            ) : null}
            {footer.taxCode || footer.licenseInfo ? (
              <p className="text-slate-400">
                {[
                  footer.taxCode ? `Mã số doanh nghiệp: ${footer.taxCode}` : null,
                  footer.licenseInfo || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {bctImg ? (
              footer.bctBadgeUrl ? (
                <a
                  href={footer.bctBadgeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Đã đăng ký với Bộ Công Thương"
                  className="inline-block rounded-lg bg-white/95 p-1.5 shadow-xs transition hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bctImg}
                    alt="Đã thông báo / đăng ký Bộ Công Thương"
                    className="h-9 w-auto object-contain"
                  />
                </a>
              ) : (
                <span className="inline-block rounded-lg bg-white/95 p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bctImg}
                    alt="Chứng nhận Bộ Công Thương"
                    className="h-9 w-auto object-contain"
                  />
                </span>
              )
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-slate-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Bảo vệ dữ liệu cá nhân theo NĐ 13/2023/NĐ-CP</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tầng 3: Thanh bản quyền */}
      <div className="border-t border-white/10 bg-[#051a36]">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-slate-400 sm:flex-row sm:px-6 sm:text-left">
          <p>{copyright}</p>
          {footer.bottomLinks.length > 0 ? (
            <nav
              aria-label="Liên kết pháp lý nhanh"
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5"
            >
              {footer.bottomLinks.map((link, idx) => (
                <FooterNavLink
                  key={`${link.label}-${idx}`}
                  link={link}
                  className="text-slate-400 transition hover:text-white"
                />
              ))}
            </nav>
          ) : (
            <p className="font-medium tracking-wide text-slate-500">{BRAND_NAME}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
