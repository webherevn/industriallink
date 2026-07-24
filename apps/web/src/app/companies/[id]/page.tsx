'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Factory,
  Globe,
  Linkedin,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Share2,
  Star,
  Users,
  Youtube,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  formatCompanySize,
  type CompanyPublicProfileView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { ApiError } from '@/lib/api';
import { getCompanyPublicProfile } from '@/lib/company';
import { formatSalary } from '@/lib/format';

const TABS = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'about', label: 'Giới thiệu' },
  { id: 'culture', label: 'Văn hóa công ty' },
  { id: 'benefits', label: 'Phúc lợi' },
  { id: 'reviews', label: 'Đánh giá' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={clsx(
            'h-3.5 w-3.5',
            i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
          )}
        />
      ))}
    </div>
  );
}

function SectionCard({
  id,
  title,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx(
        'progress-card animate-soft-rise scroll-mt-28 space-y-4 p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function CompanyPublicPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<TabId>('overview');
  const [descExpanded, setDescExpanded] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['company-profile', id],
    queryFn: () => getCompanyPublicProfile(id),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    if (!shareHint) return;
    const t = window.setTimeout(() => setShareHint(null), 2000);
    return () => window.clearTimeout(t);
  }, [shareHint]);

  const brand = data?.brand;
  const reviewLabel = useMemo(() => {
    const count = brand?.ratingCount ?? brand?.reviews?.length ?? 0;
    return count > 0 ? `Đánh giá (${count})` : 'Đánh giá';
  }, [brand]);

  async function onShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: data?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareHint('Đã sao chép liên kết');
      }
    } catch {
      setShareHint('Không chia sẻ được');
    }
  }

  function scrollTo(section: TabId) {
    setTab(section);
    const el = document.getElementById(section);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (isLoading) {
    return (
      <AppShell bleed>
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          Đang tải hồ sơ công ty…
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <p className="text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không tìm thấy công ty.'}
        </p>
        <Link href="/jobs" className="mt-3 inline-block text-sm font-semibold text-brand-600">
          ← Về tìm việc
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell bleed>
      <CompanyProfileView
        data={data}
        tab={tab}
        reviewLabel={reviewLabel}
        descExpanded={descExpanded}
        shareHint={shareHint}
        onTab={scrollTo}
        onToggleDesc={() => setDescExpanded((v) => !v)}
        onShare={onShare}
      />
    </AppShell>
  );
}

function CompanyProfileView({
  data,
  tab,
  reviewLabel,
  descExpanded,
  shareHint,
  onTab,
  onToggleDesc,
  onShare,
}: {
  data: CompanyPublicProfileView;
  tab: TabId;
  reviewLabel: string;
  descExpanded: boolean;
  shareHint: string | null;
  onTab: (id: TabId) => void;
  onToggleDesc: () => void;
  onShare: () => void;
}) {
  const brand = data.brand;
  const shortName = brand.internationalName ?? data.name;
  const description = data.description ?? 'Chưa có mô tả công ty.';
  const showMore = description.length > 280;
  const visibleDesc =
    !descExpanded && showMore ? `${description.slice(0, 280).trim()}…` : description;

  const stats = [
    { icon: Calendar, label: 'Năm hoạt động', value: brand.stats?.yearsActive },
    { icon: Users, label: 'Nhân sự', value: brand.stats?.employees },
    { icon: Globe, label: 'Khách hàng', value: brand.stats?.customers },
    { icon: Briefcase, label: 'Dự án', value: brand.stats?.projects },
    { icon: MapPin, label: 'Tỉnh / TP', value: brand.stats?.locations },
  ].filter((s) => s.value != null);

  const websiteHost = data.website
    ? data.website.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : null;

  return (
    <div className="min-h-screen bg-[#F5F7FB] pb-16">
      {/* Banner */}
      <div className="relative h-44 overflow-hidden sm:h-56 lg:h-64">
        {brand.bannerUrl ? (
          <Image
            src={brand.bannerUrl}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/70 via-brand-900/25 to-transparent" />
        {brand.bannerCaption && (
          <p className="absolute bottom-5 left-5 max-w-xl text-lg font-semibold text-white drop-shadow sm:bottom-8 sm:left-8 sm:text-2xl">
            {brand.bannerCaption}
          </p>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6">
        {/* Identity card */}
        <div className="-mt-10 rounded-2xl border border-slate-200/80 border-t-amber-200/90 bg-white p-4 shadow-sm animate-soft-rise sm:-mt-12 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:h-20 sm:w-20">
                {brand.logoUrl ? (
                  <Image
                    src={brand.logoUrl}
                    alt={data.name}
                    width={80}
                    height={80}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-brand-50 text-center">
                    <span className="text-lg font-extrabold tracking-tight text-brand-600 sm:text-xl">
                      {companyInitials(shortName)}
                    </span>
                    <span className="mt-0.5 hidden px-1 text-[9px] font-semibold uppercase leading-tight text-brand-500 sm:block">
                      {shortName.slice(0, 14)}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{data.name}</h1>
                  {brand.verified && (
                    <BadgeCheck className="h-5 w-5 shrink-0 text-brand-500" aria-label="Đã xác thực" />
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {brand.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Doanh nghiệp đã xác thực
                    </span>
                  )}
                  {brand.trustedEmployer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      Nhà tuyển dụng uy tín
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
                  {websiteHost && (
                    <a
                      href={data.website!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 transition hover:text-brand-600"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {websiteHost}
                    </a>
                  )}
                  {data.industry && (
                    <span className="inline-flex items-center gap-1.5">
                      <Factory className="h-3.5 w-3.5" />
                      {data.industry}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Quy mô: {formatCompanySize(data.size)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
              {data.canEdit && (
                <Link
                  href="/company"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
                >
                  <Pencil className="h-4 w-4" />
                  Chỉnh sửa thông tin
                </Link>
              )}
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" />
                Chia sẻ công ty
              </button>
              {shareHint && (
                <p className="text-center text-[11px] font-medium text-emerald-600">{shareHint}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <nav className="mt-5 flex gap-1 overflow-x-auto border-t border-slate-100 pt-1 scrollbar-none">
            {TABS.map((t) => {
              const label = t.id === 'reviews' ? reviewLabel : t.label;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTab(t.id)}
                  className={clsx(
                    'relative shrink-0 px-3 py-3 text-sm font-semibold transition',
                    active ? 'text-amber-700' : 'text-slate-500 hover:text-amber-700',
                  )}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Body */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <SectionCard
              id="about"
              title="Giới thiệu công ty"
              action={
                showMore ? (
                  <button
                    type="button"
                    onClick={onToggleDesc}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    {descExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </button>
                ) : null
              }
            >
              <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                {visibleDesc}
              </p>

              {stats.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {stats.map((s, i) => (
                    <div
                      key={s.label}
                      className="rounded-xl bg-slate-50 px-3 py-3 text-center transition hover:-translate-y-0.5 hover:bg-amber-50/70"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <s.icon className="mx-auto h-5 w-5 text-brand-500" />
                      <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                        {s.value?.toLocaleString('vi-VN')}
                      </p>
                      <p className="text-[11px] text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {(brand.coreActivities?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Lĩnh vực hoạt động chính</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {brand.coreActivities!.map((a) => (
                      <span
                        key={a}
                        className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard
              id="overview"
              title="Việc làm đang tuyển"
              action={
                data.openJobCount > 0 ? (
                  <Link
                    href={`/jobs?company=${data.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Xem tất cả {data.openJobCount} tin
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null
              }
            >
              {data.openJobs.length === 0 ? (
                <p className="text-sm text-slate-400">Hiện chưa có tin đang tuyển.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.openJobs.slice(0, 6).map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="group flex items-start gap-3 rounded-xl px-1 py-3 transition hover:bg-amber-50/50"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 transition group-hover:scale-105">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 group-hover:text-amber-800">
                              {job.title}
                            </p>
                            {job.isNew && (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                Mới đăng
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[job.department, formatSalary(job.salaryMin, job.salaryMax), job.location]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {(brand.cultureGallery?.length ?? 0) > 0 && (
              <SectionCard id="culture" title="Văn hóa công ty">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {brand.cultureGallery!.map((item) => (
                    <figure
                      key={item.url + item.title}
                      className="group overflow-hidden rounded-xl border border-slate-100 bg-white transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                        <Image
                          src={item.url}
                          alt={item.title}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-105"
                          sizes="(max-width:768px) 50vw, 20vw"
                        />
                      </div>
                      <figcaption className="p-2.5">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        {item.caption && (
                          <p className="mt-0.5 text-[11px] text-slate-500">{item.caption}</p>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </SectionCard>
            )}

            {(brand.benefits?.length ?? 0) > 0 && (
              <SectionCard id="benefits" title="Phúc lợi">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {brand.benefits!.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {((brand.reviews?.length ?? 0) > 0 || brand.ratingAvg != null) && (
              <SectionCard id="reviews" title="Đánh giá từ nhân viên">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0 rounded-2xl bg-brand-50 px-5 py-4 text-center sm:min-w-[120px]">
                    <p className="text-3xl font-extrabold text-brand-700">
                      {(brand.ratingAvg ?? 0).toFixed(1)}
                    </p>
                    <StarRow rating={brand.ratingAvg ?? 0} />
                    <p className="mt-1 text-[11px] text-slate-500">
                      {brand.ratingCount ?? brand.reviews?.length ?? 0} đánh giá
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1">
                    {(brand.reviews ?? []).map((r) => (
                      <article
                        key={`${r.name}-${r.postedAt}`}
                        className="w-[260px] shrink-0 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {companyInitials(r.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                            <p className="truncate text-[11px] text-slate-500">{r.role}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <StarRow rating={r.rating} />
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                          {r.comment}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <SectionCard title="Thông tin công ty" className="!p-4">
              <dl className="space-y-2.5 text-sm">
                {[
                  { label: 'Tên đầy đủ', value: data.name },
                  { label: 'Tên quốc tế', value: brand.internationalName },
                  { label: 'Mã số thuế', value: data.taxCode },
                  { label: 'Địa chỉ', value: data.address },
                  { label: 'Email', value: brand.email },
                  { label: 'Điện thoại', value: brand.phone },
                  { label: 'Website', value: websiteHost },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <div key={row.label} className="grid grid-cols-[100px_1fr] gap-2">
                      <dt className="text-slate-400">{row.label}</dt>
                      <dd className="font-medium text-slate-800 break-words">
                        {row.label === 'Website' && data.website ? (
                          <a
                            href={data.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 hover:underline"
                          >
                            {row.value}
                          </a>
                        ) : (
                          row.value
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {brand.facebookUrl && (
                  <a
                    href={brand.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Facebook"
                  >
                    <span className="text-xs font-bold">f</span>
                  </a>
                )}
                {brand.linkedinUrl && (
                  <a
                    href={brand.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {brand.youtubeUrl && (
                  <a
                    href={brand.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="YouTube"
                  >
                    <Youtube className="h-4 w-4" />
                  </a>
                )}
                {data.website && (
                  <a
                    href={data.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Website"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                )}
                {brand.phone && (
                  <a
                    href={`tel:${brand.phone}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Gọi điện"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
            </SectionCard>

            {(brand.whyChooseUs?.length ?? 0) > 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 via-white to-brand-50/40 p-5 shadow-sm">
                <Award className="pointer-events-none absolute -right-2 -bottom-2 h-24 w-24 text-amber-200/60" />
                <h3 className="relative text-sm font-bold text-slate-900">
                  Tại sao chọn {brand.internationalName ?? 'chúng tôi'}?
                </h3>
                <ul className="relative mt-3 space-y-2">
                  {brand.whyChooseUs!.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(brand.awards?.length ?? 0) > 0 && (
              <SectionCard title="Chứng nhận & giải thưởng" className="!p-4">
                <div className="flex flex-wrap gap-2">
                  {brand.awards!.map((a) => (
                    <span
                      key={a.name}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      <Award className="h-3.5 w-3.5 text-amber-500" />
                      {a.name}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {data.openJobs.length > 0 && (
              <SectionCard
                title="Vị trí nổi bật"
                className="!p-4"
                action={
                  <Link href={`/jobs?company=${data.id}`} className="text-[11px] font-semibold text-brand-600">
                    Xem tất cả
                  </Link>
                }
              >
                <ul className="space-y-2.5">
                  {data.openJobs.slice(0, 4).map((job) => (
                    <li key={job.id}>
                      <Link href={`/jobs/${job.id}`} className="block rounded-lg p-1.5 transition hover:bg-slate-50">
                        <p className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                          {job.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatSalary(job.salaryMin, job.salaryMax)}
                          {job.location ? ` · ${job.location}` : ''}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-center text-[11px] text-slate-400">
              <Building2 className="mx-auto mb-1 h-4 w-4" />
              Mã công ty: {data.code}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
