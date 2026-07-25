'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Car,
  Languages,
  Loader2,
  MapPin,
  Plane,
  Sparkles,
  Target,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  B2B_EXPERIENCE_BAND_LABEL,
  B2bExperienceBand,
  CUSTOMER_DEV_STYLE_LABEL,
  CustomerDevStyle,
  DEAL_TYPE_LABEL,
  DealType,
  JOB_READINESS_LABEL,
  JobReadiness,
  formatJobLevel,
  formatJobTitle,
} from '@industriallink/contracts';
import { RecruiterShell } from '@/components/recruiter-shell';
import { ApiError } from '@/lib/api';
import { getCandidateById } from '@/lib/candidate';
import { formatVndAmount } from '@/lib/format';

function money(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return formatVndAmount(v);
}

function ChipList({ items, empty = 'Chưa cập nhật' }: { items?: string[]; empty?: string }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="progress-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {Icon && <Icon className="h-4 w-4 text-brand-600" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidateById(id),
    enabled: Boolean(id),
    retry: false,
  });

  const sales = data?.profile?.sales;
  const profile = data?.profile;

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-4xl space-y-4 animate-soft-rise pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại tìm kiếm
          </Link>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
            Đang tải hồ sơ ứng viên…
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-rose-700">
              {error instanceof ApiError ? error.message : 'Không tải được hồ sơ ứng viên'}
            </p>
            <Link
              href="/search"
              className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
            >
              Về trang tìm kiếm
            </Link>
          </div>
        )}

        {data && (
          <>
            <header className="progress-card overflow-hidden">
              <div className="bg-gradient-to-br from-brand-50 via-white to-sky-50/50 px-5 py-6 sm:px-7">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-md shadow-brand-500/30">
                    {data.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {data.displayName}
                      </h1>
                      <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        {data.code}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        {profile?.currentPosition
                          ? formatJobTitle(profile.currentPosition)
                          : 'Chưa cập nhật vị trí'}
                      </span>
                      {profile?.industry && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {profile.industry}
                          </span>
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile?.jobLevel && (
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          {formatJobLevel(profile.jobLevel)}
                        </span>
                      )}
                      {sales?.b2bExperienceBand && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Kinh nghiệm B2B{' '}
                          {B2B_EXPERIENCE_BAND_LABEL[
                            sales.b2bExperienceBand as B2bExperienceBand
                          ] ?? sales.b2bExperienceBand}
                        </span>
                      )}
                      {sales?.jobReadiness && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {JOB_READINESS_LABEL[sales.jobReadiness as JobReadiness] ??
                            sales.jobReadiness}
                        </span>
                      )}
                      {data.aiProfile?.aiScore != null && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                          <Sparkles className="h-3 w-3" />
                          AI {Math.round(data.aiProfile.aiScore)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Hồ sơ
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-brand-600">
                      {data.profileCompletion}%
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {(profile?.summary || data.aiProfile?.summary) && (
              <Section title="Tóm tắt">
                <p className="text-sm leading-relaxed text-slate-700">
                  {profile?.summary || data.aiProfile?.summary}
                </p>
              </Section>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Ngành đã làm" icon={Target}>
                <ChipList
                  items={
                    profile?.industriesExperienced?.length
                      ? profile.industriesExperienced
                      : profile?.industry
                        ? [profile.industry]
                        : []
                  }
                />
              </Section>
              <Section title="Khu vực / thị trường" icon={MapPin}>
                <ChipList items={sales?.marketsCovered} />
              </Section>
              <Section title="Sản phẩm đã bán">
                <ChipList items={sales?.productsSold} />
              </Section>
              <Section title="Tệp khách hàng">
                <ChipList items={sales?.customerSegments} />
              </Section>
            </div>

            <Section title="Kinh doanh B2B — đánh giá nâng cao">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Phong cách & hành vi Sales
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {sales?.salesBehavior ||
                      (sales?.customerDevStyle
                        ? (CUSTOMER_DEV_STYLE_LABEL[
                            sales.customerDevStyle as CustomerDevStyle
                          ] ?? sales.customerDevStyle)
                        : '—')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Loại thương vụ
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {sales?.dealType
                      ? (DEAL_TYPE_LABEL[sales.dealType as DealType] ?? sales.dealType)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Doanh số gần nhất
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {money(sales?.latestRevenue) ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    % KPI
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {sales?.kpiAchievementPct != null
                      ? `${Math.round(sales.kpiAchievementPct)}%`
                      : '—'}
                  </p>
                </div>
              </div>
              {sales?.salesHighlights && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {sales.salesHighlights}
                </p>
              )}
              {sales?.sellingStages && sales.sellingStages.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Năng lực bán giải pháp
                  </p>
                  <ChipList items={sales.sellingStages} />
                </div>
              )}
            </Section>

            <Section title="Điều kiện bổ sung">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <Languages className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Ngoại ngữ
                    </p>
                    <ChipList items={sales?.languages} empty="Chưa cập nhật" />
                  </div>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <p className="inline-flex items-center gap-1.5">
                    <Car className="h-4 w-4 text-slate-400" />
                    Bằng B2:{' '}
                    <span className="font-semibold">
                      {sales?.hasB2License == null
                        ? '—'
                        : sales.hasB2License
                          ? 'Có'
                          : 'Không'}
                    </span>
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <Plane className="h-4 w-4 text-slate-400" />
                    Đi công tác:{' '}
                    <span className="font-semibold">
                      {sales?.willingToTravel == null
                        ? '—'
                        : sales.willingToTravel
                          ? 'Sẵn sàng'
                          : 'Không'}
                    </span>
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <Wallet className="h-4 w-4 text-slate-400" />
                    Thu nhập kỳ vọng:{' '}
                    <span className="font-semibold">
                      {sales?.expectedSalaryMin || sales?.expectedSalaryMax
                        ? `${money(sales.expectedSalaryMin) ?? '?'} – ${money(sales.expectedSalaryMax) ?? '?'}`
                        : '—'}
                    </span>
                  </p>
                </div>
              </div>
            </Section>

            <Section title="Kỹ năng">
              <ChipList items={data.skills.map((s) => s.name)} empty="Chưa có kỹ năng" />
            </Section>

            {data.aiProfile &&
              (data.aiProfile.strengths.length > 0 || data.aiProfile.weaknesses.length > 0) && (
                <Section title="Nhận xét AI" icon={Sparkles}>
                  {data.aiProfile.strengths.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                        Điểm mạnh
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                        {data.aiProfile.strengths.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.aiProfile.weaknesses.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                        Cần cải thiện
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                        {data.aiProfile.weaknesses.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Section>
              )}
          </>
        )}
      </div>
    </RecruiterShell>
  );
}
