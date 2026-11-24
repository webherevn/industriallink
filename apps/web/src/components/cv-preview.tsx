'use client';

import clsx from 'clsx';
import { Calendar, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  B2B_EXPERIENCE_BAND_LABEL,
  JobTrack,
  SHIFT_FLEXIBILITY_OPTIONS,
  TECHNICAL_AUTONOMY_LEVELS,
  TRACK_FIELD_LABELS,
  TRAVEL_ABILITY_LABEL,
  TROUBLESHOOTING_LEVELS,
  formatDealTypes,
  formatLanguageSkillSummary,
  formatVnAddress,
} from '@industriallink/contracts';
import { SafeHtml, looksLikeHtml } from '@/components/render-safe-html';
import { toBulletLines } from '@/lib/bullet-text';
import type { CvDraft, CvTemplate } from '@/lib/cv-templates';
import { formatVndAmount } from '@/lib/format';

function initials(name: string): string {
  return (name || 'UV')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}

function formatRevenue(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return formatVndAmount(v);
}

/** % KPI (nhập theo band 18.8) → nhãn band để hiển thị. */
function kpiBandLabel(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < 70) return 'Dưới 70%';
  if (pct <= 100) return '70 – 100%';
  return 'Trên 100%';
}

/** % KH tự tìm → nhãn band 18.8. */
function newCustomerBandLabel(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < 50) return 'Dưới 50%';
  if (pct <= 80) return '50 – 80%';
  return 'Trên 80%';
}

/** VND → nhãn band giá trị hợp đồng 18.8. */
function dealValueBandLabel(vnd: number | null | undefined): string | null {
  if (vnd == null || !Number.isFinite(vnd)) return null;
  if (vnd < 50_000_000) return 'Dưới 50 triệu';
  if (vnd < 200_000_000) return '50 – 200 triệu';
  if (vnd < 500_000_000) return '200 – 500 triệu';
  if (vnd < 2_000_000_000) return '500 triệu – 2 tỷ';
  if (vnd < 10_000_000_000) return '2 – 10 tỷ';
  return 'Trên 10 tỷ';
}

function labelOf(
  map: Record<string, string>,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

function autonomyLabel(level: number | null | undefined): string | null {
  if (level == null) return null;
  return TECHNICAL_AUTONOMY_LEVELS.find((l) => l.value === level)?.label ?? null;
}

function troubleshootingLabel(level: number | null | undefined): string | null {
  if (level == null) return null;
  return TROUBLESHOOTING_LEVELS.find((l) => l.value === level)?.label ?? null;
}

function formatExpectedIncome(draft: CvDraft): string | null {
  const min = draft.expectedSalaryMin;
  const max = draft.expectedSalaryMax;
  const ote = draft.expectedOte;
  const parts: string[] = [];
  if (min != null && max != null && max > min) {
    parts.push(`${formatVndAmount(min)} – ${formatVndAmount(max)}`);
  } else if (min != null) {
    parts.push(`Từ ${formatVndAmount(min)}`);
  } else if (max != null) {
    parts.push(`Đến ${formatVndAmount(max)}`);
  }
  if (ote != null) {
    parts.push(`OTE ${formatVndAmount(ote)}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function formatLanguageEntries(draft: CvDraft): string[] {
  if (draft.languageSkills?.length) {
    return draft.languageSkills.map(formatLanguageSkillSummary).filter(Boolean);
  }
  return draft.languages.map((l) => l.trim()).filter(Boolean);
}

function RichOrBullets({
  text,
  compact,
}: {
  text: string;
  compact?: boolean;
}) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  if (looksLikeHtml(trimmed)) {
    return (
      <SafeHtml
        html={trimmed}
        className={clsx(
          'profile-normalized-rich leading-relaxed text-slate-700',
          compact ? 'text-[9.5px]' : 'text-[11px]',
        )}
      />
    );
  }
  const lines = toBulletLines(trimmed);
  if (lines.length === 0) return null;
  if (lines.length === 1) {
    return (
      <p
        className={clsx(
          'whitespace-pre-line leading-relaxed text-slate-700',
          compact ? 'text-[9.5px]' : 'text-[11px]',
        )}
      >
        {lines[0]}
      </p>
    );
  }
  return (
    <ul className="space-y-1 pl-4">
      {lines.map((line, i) => (
        <li
          key={`${i}-${line.slice(0, 24)}`}
          className={clsx(
            'list-disc leading-relaxed text-slate-700 marker:text-slate-400',
            compact ? 'text-[9.5px]' : 'text-[11px]',
          )}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function Chip({
  children,
  dark,
  compact,
}: {
  children: ReactNode;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={clsx(
        // Bù baseline shift của html2canvas cho tiếng Việt có dấu
        'inline-flex max-w-full items-center justify-center rounded-md font-semibold leading-none',
        compact ? 'px-2 pt-[2px] pb-[6px] text-[8.5px]' : 'px-2.5 pt-[2px] pb-[7px] text-[10px]',
        dark
          ? 'border border-white/20 bg-white/15 text-white'
          : 'border border-slate-200/90 bg-slate-100 text-slate-800',
      )}
    >
      {children}
    </span>
  );
}

function AvatarPhoto({
  name,
  src,
  compact,
  dark,
}: {
  name: string;
  src?: string | null;
  compact?: boolean;
  dark?: boolean;
}) {
  const size = compact ? 'h-14 w-14 text-sm' : 'h-[82px] w-[82px] text-lg';
  return (
    <div
      className={clsx(
        'mx-auto flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 font-bold tracking-wide',
        size,
        dark
          ? 'border-white/45 bg-white/15 text-white'
          : 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function InfoGrid({
  rows,
  compact,
}: {
  rows: Array<{ label: string; value: string | null | undefined }>;
  compact?: boolean;
}) {
  const valid = rows.filter((r) => Boolean(r.value && r.value.trim()));
  if (valid.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
      {valid.map((row) => (
        <div
          key={row.label}
          data-cv-block
          className="border-b border-slate-100 pb-1.5"
        >
          <p
            className={clsx(
              'font-bold uppercase tracking-[0.06em] text-slate-500',
              compact ? 'text-[8px]' : 'text-[9px]',
            )}
          >
            {row.label}
          </p>
          <p
            className={clsx(
              'mt-0.5 font-medium leading-snug text-slate-800',
              compact ? 'text-[9.5px]' : 'text-[10.5px]',
            )}
          >
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({
  title,
  accent,
  classic,
  compact,
}: {
  title: string;
  accent: string;
  classic?: boolean;
  compact?: boolean;
}) {
  if (classic) {
    return (
      <div className="mb-2 border-b-[1.5px] pb-1.5" style={{ borderColor: accent }}>
        <h3
          className={clsx(
            'font-extrabold uppercase leading-snug tracking-[0.12em]',
            compact ? 'text-[10px]' : 'text-[11.5px]',
          )}
          style={{ color: accent }}
        >
          {title}
        </h3>
      </div>
    );
  }
  // Dùng border-b trực tiếp (khớp 100% baseline trong cả browser & html2canvas, không lệch dọc)
  return (
    <div className="mb-2 border-b border-slate-200/90 pb-1">
      <h3
        className={clsx(
          'inline-block border-b-2 pb-1 -mb-[5px] font-extrabold uppercase leading-snug tracking-[0.09em]',
          compact ? 'text-[10px]' : 'text-[11.5px]',
        )}
        style={{ color: accent, borderColor: accent }}
      >
        {title}
      </h3>
    </div>
  );
}

function ExperienceBlock({
  exp,
  accent,
  compact,
  jobTrack,
}: {
  exp: CvDraft['experience'][number];
  accent: string;
  compact?: boolean;
  jobTrack?: CvDraft['jobTrack'];
}) {
  const isTech = jobTrack === JobTrack.Technical;
  const detailRows: { label: string; value: string }[] = [];

  if (exp.industries.length) {
    detailRows.push({
      label: 'Lĩnh vực',
      value: exp.industries.slice(0, 6).join(', '),
    });
  }
  if (exp.productsSold.length) {
    detailRows.push({
      label: isTech ? 'Thiết bị / hệ thống' : 'Sản phẩm',
      value: exp.productsSold.slice(0, 6).join(', '),
    });
  }
  if ((exp.brandsTechnologies?.length ?? 0) > 0) {
    detailRows.push({
      label: isTech ? 'Hãng / công nghệ' : 'Hãng / thương hiệu',
      value: (exp.brandsTechnologies ?? []).slice(0, 8).join(', '),
    });
  }
  if (exp.customerSegments.length) {
    detailRows.push({
      label: isTech ? 'Môi trường làm việc' : 'Khách hàng',
      value: exp.customerSegments.slice(0, 5).join(', '),
    });
  }
  if (isTech) {
    const expAutonomy = autonomyLabel(exp.technicalAutonomyLevel);
    if (expAutonomy) {
      detailRows.push({ label: 'Mức độ tự chủ', value: expAutonomy });
    }
  } else {
    if (exp.marketsCovered.length) {
      detailRows.push({
        label: 'Thị trường',
        value: exp.marketsCovered.slice(0, 5).join(', '),
      });
    }
    const deal = formatDealTypes(exp.dealType);
    if (deal) detailRows.push({ label: 'Giải pháp sản phẩm', value: deal });
    const rev = formatRevenue(exp.latestRevenue);
    if (rev) detailRows.push({ label: 'Doanh số 12 tháng', value: rev });
    const kpi = kpiBandLabel(exp.kpiAchievementPct);
    if (kpi) detailRows.push({ label: 'Hoàn thành KPI', value: kpi });
    const ratio = newCustomerBandLabel(exp.newCustomerRatioPct);
    if (ratio) detailRows.push({ label: 'KH tự tìm kiếm', value: ratio });
    const dealValue = dealValueBandLabel(exp.typicalDealValue);
    if (dealValue) detailRows.push({ label: 'Giá trị HĐ thường gặp', value: dealValue });
    const maxDeal = dealValueBandLabel(exp.maxDealValue);
    if (maxDeal) detailRows.push({ label: 'Giá trị HĐ lớn nhất', value: maxDeal });
  }

  return (
    <div
      data-cv-block
      className={clsx(
        'mb-4 border-b border-slate-100 pb-3.5 last:mb-0 last:border-0 last:pb-0',
        compact && 'mb-3 pb-2.5',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p
          className={clsx(
            'font-extrabold leading-snug text-slate-900',
            compact ? 'text-[11px]' : 'text-[12.5px]',
          )}
        >
          {exp.role}
        </p>
        {exp.period ? (
          <span
            className={clsx(
              'inline-flex shrink-0 items-center justify-center rounded bg-slate-100 px-2 pt-[3px] pb-[5px] font-bold leading-none text-slate-600',
              compact ? 'text-[8.5px]' : 'text-[9.5px]',
            )}
          >
            {exp.period}
          </span>
        ) : null}
      </div>
      <p
        className={clsx('mt-0.5 font-semibold', compact ? 'text-[10px]' : 'text-[11px]')}
        style={{ color: accent }}
      >
        {exp.company}
      </p>

      {detailRows.length > 0 && (
        <dl className="mt-2 space-y-0.5">
          {detailRows.map((row) => (
            <div
              key={row.label}
              className={clsx('flex gap-1.5 leading-snug', compact ? 'text-[8.5px]' : 'text-[10px]')}
            >
              <dt className="shrink-0 font-bold text-slate-600">{row.label}:</dt>
              <dd className="min-w-0 text-slate-600">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {exp.sellingStages.length > 0 && (
        <p
          className={clsx(
            'mt-1.5 leading-snug text-slate-600',
            compact ? 'text-[8.5px]' : 'text-[10px]',
          )}
        >
          <span className="font-bold text-slate-700">
            {isTech ? 'Công việc kỹ thuật' : 'Phạm vi công việc'}:
          </span>{' '}
          {exp.sellingStages.join(' · ')}
        </p>
      )}

      {(exp.jobDescription ?? '').trim() ? (
        <div className="mt-2">
          <p
            className={clsx(
              'mb-0.5 font-bold uppercase tracking-[0.06em] text-slate-500',
              compact ? 'text-[8px]' : 'text-[9px]',
            )}
          >
            Mô tả công việc
          </p>
          <RichOrBullets text={exp.jobDescription ?? ''} compact={compact} />
        </div>
      ) : null}

      {(exp.bullets ?? '').trim() ? (
        <div className="mt-2">
          {(exp.jobDescription ?? '').trim() ? (
            <p
              className={clsx(
                'mb-0.5 font-bold uppercase tracking-[0.06em] text-slate-500',
                compact ? 'text-[8px]' : 'text-[9px]',
              )}
            >
              {isTech ? 'Kết quả / dự án nổi bật' : 'Thành tích nổi bật'}
            </p>
          ) : null}
          <RichOrBullets text={exp.bullets} compact={compact} />
        </div>
      ) : null}
    </div>
  );
}

function CapabilitySection({
  draft,
  accent,
  classic,
  compact,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
  compact?: boolean;
}) {
  const isTech = draft.jobTrack === JobTrack.Technical;
  const productLabel = isTech
    ? TRACK_FIELD_LABELS.productsSold[JobTrack.Technical]
    : TRACK_FIELD_LABELS.productsSold[JobTrack.Sales];
  const segmentLabel = isTech
    ? TRACK_FIELD_LABELS.customerSegments[JobTrack.Technical]
    : TRACK_FIELD_LABELS.customerSegments[JobTrack.Sales];

  const allBrands = [
    ...new Set([
      ...draft.brandsTechnologies,
      ...draft.experience.flatMap((e) => e.brandsTechnologies ?? []),
    ]),
  ].filter(Boolean);

  const uniqueWorkTypes = [
    ...new Set(
      draft.technicalWorkTypes.length
        ? draft.technicalWorkTypes
        : draft.experience.flatMap((e) => e.sellingStages),
    ),
  ].filter(Boolean);

  const uniqueEquipment = [
    ...new Set(
      draft.productsSold.length
        ? draft.productsSold
        : draft.experience.flatMap((e) => e.productsSold),
    ),
  ].filter(Boolean);

  const uniqueEnvironments = [
    ...new Set(
      draft.customerSegments.length
        ? draft.customerSegments
        : draft.experience.flatMap((e) => e.customerSegments),
    ),
  ].filter(Boolean);

  const rows: Array<{ label: string; value: string | null | undefined }> = isTech
    ? [
        { label: 'Lĩnh vực hoạt động', value: draft.industriesExperienced.join(', ') },
        { label: productLabel, value: uniqueEquipment.join(', ') },
        { label: 'Hãng / công nghệ', value: allBrands.join(', ') },
        { label: 'Công việc kỹ thuật', value: uniqueWorkTypes.join(', ') },
        { label: segmentLabel, value: uniqueEnvironments.join(', ') },
        { label: 'Mức độ tự chủ', value: autonomyLabel(draft.technicalAutonomyLevel) },
        { label: 'Mức xử lý sự cố', value: troubleshootingLabel(draft.troubleshootingLevel) },
        { label: 'Phần mềm / công cụ', value: draft.technicalTools.join(', ') },
        { label: 'Đọc bản vẽ / tài liệu', value: draft.documentLiteracy.join(', ') },
        { label: 'Quy mô / công suất hệ thống', value: draft.systemScaleNote },
      ]
    : [
        { label: 'Ngành hàng', value: draft.industriesExperienced.join(', ') },
        {
          label: 'Kinh nghiệm B2B',
          value: labelOf(B2B_EXPERIENCE_BAND_LABEL, draft.b2bExperienceBand),
        },
        { label: productLabel, value: uniqueEquipment.join(', ') },
        { label: 'Hãng / thương hiệu', value: allBrands.join(', ') },
        { label: segmentLabel, value: uniqueEnvironments.join(', ') },
        { label: 'Thị trường phụ trách', value: draft.marketsCovered.join(', ') },
        { label: 'Giải pháp sản phẩm', value: formatDealTypes(draft.dealType) },
        { label: 'Giá trị HĐ thường gặp', value: dealValueBandLabel(draft.typicalDealValue) },
        { label: 'Giá trị HĐ lớn nhất', value: dealValueBandLabel(draft.maxDealValue) },
        { label: 'KH tự tìm kiếm', value: newCustomerBandLabel(draft.newCustomerRatioPct) },
        { label: 'Phong cách Sales', value: draft.salesBehavior },
      ];

  const hasRows = rows.some((r) => Boolean(r.value && r.value.trim()));
  const hasSalesHighlights = !isTech && Boolean(draft.salesHighlights?.trim());
  if (!hasRows && !hasSalesHighlights) return null;

  return (
    <section data-cv-block className="mb-3.5">
      <SectionTitle
        title={isTech ? 'Năng lực kỹ thuật' : 'Năng lực Sales B2B'}
        accent={accent}
        classic={classic}
        compact={compact}
      />
      <InfoGrid rows={rows} compact={compact} />
      {hasSalesHighlights && (
        <div data-cv-block className="mt-2.5 rounded-lg bg-slate-50/90 px-3 py-2 border border-slate-100">
          <p
            className={clsx(
              'mb-1 font-bold uppercase tracking-[0.08em] text-slate-500',
              compact ? 'text-[8px]' : 'text-[9px]',
            )}
          >
            {TRACK_FIELD_LABELS.salesHighlights[JobTrack.Sales]}
          </p>
          <RichOrBullets text={draft.salesHighlights} compact={compact} />
        </div>
      )}
    </section>
  );
}

function ConditionsSection({
  draft,
  accent,
  classic,
  compact,
  includeLanguages,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
  compact?: boolean;
  includeLanguages?: boolean;
}) {
  const availability = labelOf(AVAILABILITY_BAND_LABEL, draft.availabilityBand);
  const travel = labelOf(TRAVEL_ABILITY_LABEL, draft.travelAbility);
  const license =
    draft.driverLicenseType?.trim() ||
    (draft.hasB2License == null ? null : draft.hasB2License ? 'Ô tô' : 'Chưa có');
  const shift =
    draft.jobTrack === JobTrack.Technical && draft.shiftFlexibility != null
      ? SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.value === draft.shiftFlexibility)?.label
      : null;
  const income = formatExpectedIncome(draft);
  const langs = includeLanguages ? formatLanguageEntries(draft) : [];

  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Thời gian nhận việc', value: availability },
    { label: 'Thu nhập kỳ vọng', value: income },
    { label: 'Địa điểm mong muốn', value: draft.desiredLocations.join(', ') },
    { label: 'Khả năng đi công tác', value: travel },
    { label: 'Bằng lái xe', value: license },
    ...(shift ? [{ label: 'Làm ca / ngoài giờ', value: shift }] : []),
    ...(langs.length ? [{ label: 'Ngoại ngữ', value: langs.join('; ') }] : []),
  ];

  if (!rows.some((r) => Boolean(r.value && r.value.trim()))) return null;

  return (
    <section data-cv-block className="mb-3.5">
      <SectionTitle
        title="Điều kiện làm việc"
        accent={accent}
        classic={classic}
        compact={compact}
      />
      <InfoGrid rows={rows} compact={compact} />
    </section>
  );
}

function PreferencesSection({
  draft,
  accent,
  classic,
  compact,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
  compact?: boolean;
}) {
  const isTech = draft.jobTrack === JobTrack.Technical;
  const has =
    draft.desiredPositions.length > 0 ||
    draft.careerMotivations.length > 0 ||
    draft.careerOrientations.length > 0 ||
    draft.workStyles.length > 0 ||
    (isTech && draft.desiredWorkEnvironments.length > 0) ||
    draft.hobbies.length > 0;

  if (!has) return null;

  const subHeading = clsx(
    'mb-1.5 font-bold uppercase tracking-[0.08em] text-slate-500',
    compact ? 'text-[8px]' : 'text-[9px]',
  );

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle
        title="Định hướng & sở thích"
        accent={accent}
        classic={classic}
        compact={compact}
      />
      <div className="space-y-2.5">
        {draft.desiredPositions.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>Vị trí mong muốn</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.desiredPositions.map((p, i) => (
                <Chip key={`pos-${i}-${p}`} compact={compact}>
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {draft.careerOrientations.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>Định hướng nghề nghiệp</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.careerOrientations.map((o, i) => (
                <Chip key={`ori-${i}-${o}`} compact={compact}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {draft.careerMotivations.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>Động lực nghề nghiệp</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.careerMotivations.map((m, i) => (
                <Chip key={`mot-${i}-${m}`} compact={compact}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {isTech && draft.desiredWorkEnvironments.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>Môi trường làm việc mong muốn</p>
            <div className="flex flex-wrap gap-1.5">
              {draft.desiredWorkEnvironments.map((e, i) => (
                <Chip key={`env-${i}-${e}`} compact={compact}>
                  {e}
                </Chip>
              ))}
            </div>
          </div>
        )}
        {draft.workStyles.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>
              {isTech ? 'Cách làm việc kỹ thuật' : 'Phong cách & môi trường làm việc'}
            </p>
            <ul className="space-y-1 pl-4">
              {draft.workStyles.map((w, i) => (
                <li
                  key={`ws-${i}-${w}`}
                  className={clsx(
                    'list-disc leading-snug text-slate-700 marker:text-slate-400',
                    compact ? 'text-[9.5px]' : 'text-[10.5px]',
                  )}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {draft.hobbies.length > 0 && (
          <div data-cv-block>
            <p className={subHeading}>Sở thích</p>
            {draft.hobbies.length === 1 && looksLikeHtml(draft.hobbies[0]) ? (
              <SafeHtml
                html={draft.hobbies[0]}
                className={clsx(
                  'profile-normalized-rich leading-relaxed text-slate-700',
                  compact ? 'text-[9.5px]' : 'text-[10.5px]',
                )}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.hobbies.map((h, i) => (
                  <Chip key={`hobby-${i}-${h}`} compact={compact}>
                    {h}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Thứ tự mục chuẩn HR quốc tế & B2B:
 * 1. Giới thiệu & Mục tiêu → 2. Kinh nghiệm làm việc → 3. Năng lực chuyên môn
 * → 4. Học vấn / Dự án / Chứng chỉ → 5. Điều kiện làm việc → 6. Định hướng & Sở thích.
 */
function MainSections({
  draft,
  accent,
  classic,
  compact,
  includeLanguagesInConditions,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
  compact?: boolean;
  includeLanguagesInConditions?: boolean;
}) {
  return (
    <>
      {(draft.summary || draft.careerObjective) && (
        <section data-cv-block className="mb-3.5">
          <SectionTitle title="Giới thiệu" accent={accent} classic={classic} compact={compact} />
          {draft.careerObjective && (
            <div
              className="mb-2 border-l-2 bg-slate-50/80 py-1.5 pl-3 pr-2.5"
              style={{ borderColor: accent }}
            >
              <p
                className={clsx(
                  'whitespace-pre-line leading-relaxed text-slate-700',
                  compact ? 'text-[9.5px]' : 'text-[10.5px]',
                )}
              >
                <span className="font-bold text-slate-900">Mục tiêu nghề nghiệp: </span>
                {draft.careerObjective}
              </p>
            </div>
          )}
          {draft.summary ? <RichOrBullets text={draft.summary} compact={compact} /> : null}
        </section>
      )}

      {draft.experience.length > 0 && (
        <section data-cv-block className="mb-3.5">
          <SectionTitle
            title="Kinh nghiệm làm việc"
            accent={accent}
            classic={classic}
            compact={compact}
          />
          {draft.experience.map((e, i) => (
            <ExperienceBlock
              key={`${e.company}-${e.role}-${i}`}
              exp={e}
              accent={accent}
              compact={compact}
              jobTrack={draft.jobTrack}
            />
          ))}
        </section>
      )}

      <CapabilitySection draft={draft} accent={accent} classic={classic} compact={compact} />

      {draft.education.length > 0 && (
        <section data-cv-block className="mb-3.5">
          <SectionTitle title="Học vấn" accent={accent} classic={classic} compact={compact} />
          {draft.education.map((e, i) => {
            const heading = e.school?.trim() || e.degree?.trim() || draft.educationLevel || '';
            const subParts = [
              e.school?.trim() ? draft.educationLevel : null,
              e.school?.trim() ? e.degree : null,
              e.period,
            ].filter(Boolean);
            return (
              <div key={`${e.school}-${i}`} data-cv-block className="mb-1.5 last:mb-0">
                <p
                  className={clsx(
                    'font-bold text-slate-900',
                    compact ? 'text-[10.5px]' : 'text-[11.5px]',
                  )}
                >
                  {heading}
                </p>
                {subParts.length > 0 ? (
                  <p className={clsx('text-slate-600', compact ? 'text-[9.5px]' : 'text-[10.5px]')}>
                    {subParts.join(' · ')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      )}

      {draft.projects.length > 0 && (
        <section data-cv-block className="mb-4">
          <SectionTitle
            title="Dự án tiêu biểu"
            accent={accent}
            classic={classic}
            compact={compact}
          />
          {draft.projects.map((p, i) => (
            <div key={`${p.name}-${i}`} data-cv-block className="mb-2 last:mb-0">
              <p
                className={clsx(
                  'font-bold text-slate-900',
                  compact ? 'text-[10.5px]' : 'text-[11.5px]',
                )}
              >
                {p.name}
              </p>
              {p.detail ? <RichOrBullets text={p.detail} compact={compact} /> : null}
            </div>
          ))}
        </section>
      )}

      {draft.certificates.length > 0 && (
        <section data-cv-block className="mb-4">
          <SectionTitle title="Chứng chỉ" accent={accent} classic={classic} compact={compact} />
          <ul className="space-y-1 pl-4">
            {draft.certificates.map((c, i) => (
              <li
                key={`cert-${i}-${c}`}
                className={clsx(
                  'list-disc leading-snug text-slate-700 marker:text-slate-400',
                  compact ? 'text-[9.5px]' : 'text-[10.5px]',
                )}
              >
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConditionsSection
        draft={draft}
        accent={accent}
        classic={classic}
        compact={compact}
        includeLanguages={includeLanguagesInConditions}
      />

      <PreferencesSection draft={draft} accent={accent} classic={classic} compact={compact} />
    </>
  );
}

function SidebarSkills({
  draft,
  dark,
  compact,
}: {
  draft: CvDraft;
  dark?: boolean;
  compact?: boolean;
}) {
  const heading = clsx(
    'mb-2 font-extrabold uppercase tracking-[0.12em]',
    compact ? 'text-[8.5px]' : 'text-[10px]',
    dark ? 'text-white/80' : 'text-slate-500',
  );
  const langSummaries = formatLanguageEntries(draft);

  return (
    <div className="space-y-4">
      {draft.skills.length > 0 && (
        <div data-cv-block>
          <p className={heading}>Kỹ năng chuyên môn</p>
          <div className="flex flex-wrap gap-1.5">
            {draft.skills.slice(0, 16).map((s, i) => (
              <Chip key={`sk-${i}-${s}`} dark={dark} compact={compact}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {langSummaries.length > 0 && (
        <div data-cv-block>
          <p className={heading}>Ngoại ngữ</p>
          <ul className="space-y-1.5">
            {langSummaries.map((l, i) => (
              <li
                key={`lang-${i}-${l}`}
                className={clsx(
                  'rounded-md px-2.5 pt-[2px] pb-[7px] font-medium leading-snug',
                  compact ? 'text-[8.5px]' : 'text-[10px]',
                  dark ? 'bg-white/12 text-white' : 'border border-slate-100 bg-slate-50 text-slate-700',
                )}
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
      {draft.softSkills.length > 0 && (
        <div data-cv-block>
          <p className={heading}>Điểm mạnh</p>
          <ul className="space-y-1.5">
            {draft.softSkills.slice(0, 6).map((s, i) => (
              <li
                key={`ss-${i}-${s}`}
                className={clsx(
                  'rounded-md px-2.5 pt-[2px] pb-[7px] font-medium leading-snug',
                  compact ? 'text-[8.5px]' : 'text-[10px]',
                  dark ? 'bg-white/12 text-white' : 'border border-slate-100 bg-slate-50 text-slate-700',
                )}
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ContactLines({
  draft,
  dark,
  compact,
}: {
  draft: CvDraft;
  dark?: boolean;
  compact?: boolean;
}) {
  const cls = clsx(
    'flex items-start gap-2 leading-snug',
    compact ? 'text-[8.5px]' : 'text-[10px]',
    dark ? 'text-white/95' : 'text-slate-600',
  );
  const address = formatVnAddress({
    ward: draft.ward,
    province: draft.location,
  });
  const dob = draft.birthDate
    ? draft.birthDate.includes('-')
      ? draft.birthDate.split('-').reverse().join('/')
      : draft.birthDate
    : draft.birthYear != null
      ? String(draft.birthYear)
      : null;

  return (
    <div className="space-y-1.5">
      {draft.email && (
        <p className={cls}>
          <Mail className="mt-[3px] h-3 w-3 shrink-0 opacity-85" />
          <span className="break-all">{draft.email}</span>
        </p>
      )}
      {draft.phone && (
        <p className={cls}>
          <Phone className="mt-[3px] h-3 w-3 shrink-0 opacity-85" />
          <span>{draft.phone}</span>
        </p>
      )}
      {address && (
        <p className={cls}>
          <MapPin className="mt-[3px] h-3 w-3 shrink-0 opacity-85" />
          <span>{address}</span>
        </p>
      )}
      {dob && (
        <p className={cls}>
          <Calendar className="mt-[3px] h-3 w-3 shrink-0 opacity-85" />
          <span>Ngày sinh: {dob}</span>
        </p>
      )}
    </div>
  );
}

function LayoutSidebar({
  draft,
  template,
  compact,
  avatarUrl,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex min-h-full bg-white text-slate-800">
      <aside
        data-cv-sidebar
        data-cv-sidebar-bg={template.accent}
        className={clsx('shrink-0 text-white', compact ? 'w-[34%] p-3.5' : 'w-[31%] px-5 py-6')}
        style={{ backgroundColor: template.accent }}
      >
        <div data-cv-block>
          <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} dark />
          <p
            className={clsx(
              'mt-3.5 text-center font-extrabold leading-tight tracking-tight',
              compact ? 'text-[12.5px]' : 'text-[17px]',
            )}
          >
            {draft.fullName || 'HỌ VÀ TÊN'}
          </p>
          <p
            className={clsx(
              'mt-1.5 text-center font-bold uppercase tracking-[0.11em] text-white/85',
              compact ? 'text-[8.5px]' : 'text-[10px]',
            )}
          >
            {draft.title || 'Vị trí ứng tuyển'}
          </p>
        </div>
        <div className="my-4 h-px bg-white/25" />
        <div data-cv-block>
          <p
            className={clsx(
              'mb-2 font-extrabold uppercase tracking-[0.12em] text-white/80',
              compact ? 'text-[8.5px]' : 'text-[10px]',
            )}
          >
            Liên hệ
          </p>
          <ContactLines draft={draft} dark compact={compact} />
        </div>
        <div className="my-4 h-px bg-white/25" />
        <SidebarSkills draft={draft} dark compact={compact} />
      </aside>
      <div className={clsx('min-w-0 flex-1', compact ? 'p-3.5' : 'px-6 py-6')}>
        <MainSections draft={draft} accent={template.accent} compact={compact} />
      </div>
    </div>
  );
}

function LayoutClassic({
  draft,
  template,
  compact,
  avatarUrl,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  avatarUrl?: string | null;
}) {
  return (
    <div
      className={clsx('min-h-full bg-white text-slate-800', compact ? 'p-4' : 'px-7 py-6')}
    >
      <header
        data-cv-block
        className="border-b-2 pb-4"
        style={{ borderColor: template.accent }}
      >
        <div className="flex items-center gap-4">
          <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} />
          <div className="min-w-0 flex-1">
            <h1
              className={clsx(
                'font-extrabold tracking-tight text-slate-900',
                compact ? 'text-base' : 'text-[22px] leading-tight',
              )}
            >
              {draft.fullName || 'HỌ VÀ TÊN'}
            </h1>
            <p
              className={clsx(
                'mt-1 font-bold uppercase tracking-[0.12em]',
                compact ? 'text-[9.5px]' : 'text-[11px]',
              )}
              style={{ color: template.accent }}
            >
              {draft.title || 'Vị trí ứng tuyển'}
            </p>
            <div className="mt-2.5">
              <ContactLines draft={draft} compact={compact} />
            </div>
          </div>
        </div>
      </header>
      <div className="mt-5">
        <MainSections
          draft={draft}
          accent={template.accent}
          classic
          compact={compact}
          includeLanguagesInConditions
        />
        {(draft.skills.length > 0 || draft.softSkills.length > 0) && (
          <section data-cv-block className="mt-4">
            <SectionTitle title="Kỹ năng & Điểm mạnh" accent={template.accent} classic compact={compact} />
            <div className="flex flex-wrap gap-1.5">
              {[...draft.skills, ...draft.softSkills].slice(0, 22).map((s, i) => (
                <Chip key={`chip-${i}-${s}`} compact={compact}>
                  {s}
                </Chip>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function LayoutSplit({
  draft,
  template,
  compact,
  avatarUrl,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  avatarUrl?: string | null;
}) {
  return (
    <div className="min-h-full bg-white text-slate-800">
      <header
        data-cv-block
        className={clsx('text-white', compact ? 'px-4 py-3.5' : 'px-6 py-5')}
        style={{ backgroundColor: template.accent }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} dark />
            <div className="min-w-0">
              <h1
                className={clsx(
                  'font-extrabold tracking-tight',
                  compact ? 'text-base' : 'text-[21px] leading-tight',
                )}
              >
                {draft.fullName || 'HỌ VÀ TÊN'}
              </h1>
              <p
                className={clsx(
                  'mt-1 font-bold uppercase tracking-[0.11em] text-white/85',
                  compact ? 'text-[9px]' : 'text-[10.5px]',
                )}
              >
                {draft.title || 'Vị trí ứng tuyển'}
              </p>
            </div>
          </div>
          <div className="max-w-[42%]">
            <ContactLines draft={draft} dark compact={compact} />
          </div>
        </div>
      </header>
      <div className={clsx('grid grid-cols-12 gap-0', compact ? 'p-3.5' : 'px-6 py-4')}>
        <div className="col-span-4 border-r border-slate-100 pr-4">
          <SidebarSkills draft={draft} compact={compact} />
        </div>
        <div className="col-span-8 pl-5">
          <MainSections draft={draft} accent={template.accent} compact={compact} />
        </div>
      </div>
    </div>
  );
}

type ExecMetricItem = { label: string; value: string | null | undefined };

function ExecMetricStrip({
  items,
  compact,
  maxCols = 4,
}: {
  items: ExecMetricItem[];
  compact?: boolean;
  maxCols?: number;
}) {
  const valid = items.filter((item) => Boolean(item.value && item.value.trim()));
  if (valid.length === 0) return null;
  const cols = Math.min(valid.length, compact ? Math.min(maxCols, 2) : maxCols);
  const gridClass =
    cols === 1
      ? 'grid-cols-1'
      : cols === 2
        ? 'grid-cols-2'
        : cols === 3
          ? 'grid-cols-3'
          : cols === 5
            ? 'grid-cols-5'
            : 'grid-cols-4';
  return (
    <div
      className={clsx(
        'grid rounded-md bg-[#F1F5F9]',
        gridClass,
        compact ? 'gap-x-3 gap-y-2 px-2.5 py-2' : 'gap-x-4 gap-y-2.5 px-3.5 py-2.5',
      )}
    >
      {valid.map((item) => (
        <div key={item.label} className="min-w-0">
          <p
            className={clsx(
              'font-bold uppercase tracking-[0.05em] text-slate-500',
              compact ? 'text-[7.5px]' : 'text-[8.5px]',
            )}
          >
            {item.label}
          </p>
          <p
            className={clsx(
              'mt-0.5 break-words font-bold leading-snug text-slate-900',
              compact ? 'text-[9px]' : 'text-[10.5px]',
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Layout chuẩn form PDF chuyên nghiệp (Sales B2B & Kỹ sư Kỹ thuật):
 * Header banner màu theo template kèm ảnh ứng viên, thân 1 cột đánh số tự động 01..08,
 * tự ẩn các mục/cột không có dữ liệu và cân đối lưới cột tự động.
 */
function LayoutExecutive({
  draft,
  template,
  compact,
  avatarUrl,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  avatarUrl?: string | null;
}) {
  const isTech =
    draft.jobTrack === JobTrack.Technical ||
    (draft.jobTrack !== JobTrack.Sales && template.industry === 'technical');

  const addressText = formatVnAddress({
    ward: draft.ward,
    province: draft.location,
  });

  const subtitleText = (() => {
    const base = (draft.title || draft.desiredPositions[0] || '').trim();
    if (isTech) {
      if (!base) return 'KỸ SƯ KỸ THUẬT';
      return /kỹ thuật|kỹ sư/i.test(base) ? base : `${base} | KỸ THUẬT`;
    }
    if (!base) return 'NHÂN VIÊN KINH DOANH | SALES B2B';
    return /sales|b2b/i.test(base) ? base : `${base} | SALES B2B`;
  })();

  // 01. Vị trí mục tiêu
  const targetItems: ExecMetricItem[] = [
    {
      label: 'VỊ TRÍ',
      value: draft.desiredPositions.length > 0 ? draft.desiredPositions.join(' / ') : draft.title || null,
    },
    {
      label: 'ĐỊA ĐIỂM',
      value: draft.desiredLocations.length > 0 ? draft.desiredLocations.join(' & ') : draft.location || null,
    },
  ].filter((x) => Boolean(x.value && x.value.trim()));

  // 02. Tóm tắt năng lực
  const summaryText = (draft.summary || draft.careerObjective || '').trim();

  // 03. Điểm nổi bật
  const maxRevenue = draft.experience.reduce<number | null>((best, e) => {
    if (e.latestRevenue == null || !Number.isFinite(e.latestRevenue)) return best;
    return best == null || e.latestRevenue > best ? e.latestRevenue : best;
  }, null);
  const bestKpi = draft.experience.reduce<number | null>((best, e) => {
    if (e.kpiAchievementPct == null || !Number.isFinite(e.kpiAchievementPct)) return best;
    return best == null || e.kpiAchievementPct > best ? e.kpiAchievementPct : best;
  }, null);
  const typicalDealVal =
    draft.typicalDealValue ??
    draft.experience.find((e) => e.typicalDealValue != null)?.typicalDealValue ??
    null;

  const techWorkTypes =
    draft.technicalWorkTypes.length > 0
      ? draft.technicalWorkTypes
      : [...new Set(draft.experience.flatMap((e) => e.sellingStages))];
  const techEquip =
    draft.productsSold.length > 0
      ? draft.productsSold
      : [...new Set(draft.experience.flatMap((e) => e.productsSold))];
  const techFirstHighlight = (
    draft.salesHighlights ||
    draft.systemScaleNote ||
    draft.experience.find((e) => e.bullets.trim())?.bullets ||
    ''
  )
    .split(/\r?\n/)[0]
    ?.replace(/^[-•*]\s*/, '')
    .trim();

  const highlightItems: ExecMetricItem[] = (
    isTech
      ? [
          { label: 'KINH NGHIỆM', value: labelOf(B2B_EXPERIENCE_BAND_LABEL, draft.b2bExperienceBand) },
          {
            label: 'THIẾT BỊ / HỆ THỐNG',
            value: (techEquip.length > 0 ? techEquip : draft.industriesExperienced).slice(0, 2).join(', ') || null,
          },
          {
            label: 'CÔNG VIỆC THỰC HIỆN',
            value: techWorkTypes.slice(0, 3).join(' • ') || null,
          },
          {
            label: 'THÀNH TÍCH NỔI BẬT',
            value:
              (techFirstHighlight && techFirstHighlight.length <= 70 ? techFirstHighlight : null) ||
              troubleshootingLabel(draft.troubleshootingLevel),
          },
        ]
      : [
          { label: 'KINH NGHIỆM', value: labelOf(B2B_EXPERIENCE_BAND_LABEL, draft.b2bExperienceBand) },
          {
            label: 'DOANH SỐ CAO NHẤT',
            value: maxRevenue != null ? `${formatRevenue(maxRevenue)}/năm` : null,
          },
          { label: 'DEAL PHỔ BIẾN', value: dealValueBandLabel(typicalDealVal) },
          { label: 'KPI', value: kpiBandLabel(bestKpi) },
        ]
  ).filter((x) => Boolean(x.value && x.value.trim()));

  // 04. Kinh nghiệm làm việc
  const validExps = draft.experience.filter(
    (e) => Boolean(e.company.trim() || e.role.trim() || e.jobDescription?.trim() || e.bullets.trim()),
  );

  // 05. Năng lực chuyên sâu (bảng theo công ty — tự loại bỏ cột rỗng)
  type DeepCol = { key: string; label: string; get: (e: CvDraft['experience'][number]) => string };
  const rawDeepCols: DeepCol[] = isTech
    ? [
        { key: 'company', label: 'CÔNG TY', get: (e) => e.company.trim() },
        { key: 'equip', label: 'THIẾT BỊ / HỆ THỐNG', get: (e) => e.productsSold.join(', ') },
        { key: 'work', label: 'CÔNG VIỆC KỸ THUẬT', get: (e) => e.sellingStages.join(' • ') },
        { key: 'env', label: 'MÔI TRƯỜNG', get: (e) => e.customerSegments.join(' • ') },
        { key: 'auto', label: 'MỨC ĐỘ TỰ CHỦ', get: (e) => autonomyLabel(e.technicalAutonomyLevel) ?? '' },
      ]
    : [
        { key: 'company', label: 'CÔNG TY', get: (e) => e.company.trim() },
        { key: 'dealType', label: 'GIẢI PHÁP SẢN PHẨM', get: (e) => formatDealTypes(e.dealType) ?? '' },
        { key: 'newCust', label: 'KHÁCH HÀNG TỰ PHÁT TRIỂN', get: (e) => newCustomerBandLabel(e.newCustomerRatioPct) ?? '' },
        { key: 'dealVal', label: 'DEAL PHỔ BIẾN', get: (e) => dealValueBandLabel(e.typicalDealValue) ?? '' },
        { key: 'kpi', label: 'KPI', get: (e) => kpiBandLabel(e.kpiAchievementPct) ?? '' },
      ];
  const deepCols = rawDeepCols.filter((col) =>
    col.key === 'company' ? validExps.length > 0 : validExps.some((e) => Boolean(col.get(e))),
  );
  const showDeepTable = validExps.length > 0 && deepCols.length >= 2;
  const techExtraTools: ExecMetricItem[] = isTech
    ? [
        { label: 'PHẦN MỀM / CÔNG CỤ KỸ THUẬT', value: draft.technicalTools.join(', ') || null },
        { label: 'ĐỌC BẢN VẼ / TÀI LIỆU', value: draft.documentLiteracy.join(', ') || null },
      ].filter((x) => Boolean(x.value))
    : [];

  // 06. Học vấn & Chứng chỉ
  const eduItems: ExecMetricItem[] = [
    { label: 'HỌC VẤN', value: draft.educationLevel },
    { label: 'TRƯỜNG HỌC', value: draft.education[0]?.school || null },
    { label: 'CHUYÊN NGÀNH', value: draft.educationMajor || draft.education[0]?.degree || null },
    { label: 'CHỨNG CHỈ', value: draft.certificates.length > 0 ? draft.certificates.join(', ') : null },
    { label: 'NGOẠI NGỮ', value: formatLanguageEntries(draft).join(', ') || null },
  ].filter((x) => Boolean(x.value && x.value.trim()));

  // 07. Điều kiện làm việc
  const shiftLabel = isTech
    ? SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.value === draft.shiftFlexibility)?.label ?? null
    : null;
  const licenseLabel =
    draft.driverLicenseType ||
    (draft.hasB2License === true ? 'Ô tô (Bằng B2)' : draft.hasB2License === false ? 'Chưa có' : null);
  const conditionItems: ExecMetricItem[] = [
    { label: 'CÔNG TÁC', value: labelOf(TRAVEL_ABILITY_LABEL, draft.travelAbility) },
    { label: 'GIẤY PHÉP LÁI XE', value: licenseLabel },
    ...(isTech ? [{ label: 'LÀM NGOÀI GIỜ', value: shiftLabel }] : []),
    { label: 'THU NHẬP KỲ VỌNG', value: formatExpectedIncome(draft) },
    { label: 'NHẬN VIỆC', value: labelOf(AVAILABILITY_BAND_LABEL, draft.availabilityBand) },
  ].filter((x) => Boolean(x.value && x.value.trim()));

  // 08. Mong muốn & Môi trường phù hợp
  const aspirationItems: ExecMetricItem[] = (
    isTech
      ? [
          { label: 'ĐỊNH HƯỚNG', value: draft.careerOrientations.join(', ') || null },
          { label: 'MÔI TRƯỜNG PHÙ HỢP', value: draft.desiredWorkEnvironments.join(', ') || null },
          { label: 'CÁCH LÀM VIỆC KỸ THUẬT', value: draft.workStyles.slice(0, 3).join(', ') || null },
          { label: 'ĐỘNG LỰC', value: draft.careerMotivations.join(', ') || null },
        ]
      : [
          { label: 'ĐỊNH HƯỚNG', value: draft.careerOrientations.join(', ') || null },
          { label: 'MÔI TRƯỜNG PHÙ HỢP', value: draft.workStyles.slice(0, 3).join(', ') || null },
          { label: 'PHONG CÁCH LÀM VIỆC', value: draft.salesBehavior },
          { label: 'ĐỘNG LỰC LÀM VIỆC', value: draft.careerMotivations.join(', ') || null },
        ]
  ).filter((x) => Boolean(x.value && x.value.trim()));

  // Gom các mục có dữ liệu để đánh số liên tục 01, 02, 03...
  const sections: Array<{ key: string; title: string; content: ReactNode }> = [];

  if (targetItems.length > 0) {
    sections.push({
      key: 'target',
      title: 'VỊ TRÍ MỤC TIÊU',
      content: <ExecMetricStrip items={targetItems} compact={compact} maxCols={2} />,
    });
  }

  if (summaryText) {
    sections.push({
      key: 'summary',
      title: 'TÓM TẮT NĂNG LỰC',
      content: (
        <p
          className={clsx(
            'whitespace-pre-line leading-relaxed text-slate-700',
            compact ? 'text-[9px]' : 'text-[11px]',
          )}
        >
          {summaryText}
        </p>
      ),
    });
  }

  if (highlightItems.length > 0) {
    sections.push({
      key: 'highlights',
      title: 'ĐIỂM NỔI BẬT',
      content: <ExecMetricStrip items={highlightItems} compact={compact} maxCols={4} />,
    });
  }

  if (validExps.length > 0) {
    sections.push({
      key: 'experience',
      title: 'KINH NGHIỆM LÀM VIỆC',
      content: (
        <div className={clsx(compact ? 'space-y-3' : 'space-y-4')}>
          {validExps.map((exp, idx) => {
            const expMetrics: ExecMetricItem[] = isTech
              ? [
                  { label: 'LĨNH VỰC', value: exp.industries.join(', ') || null },
                  { label: 'THIẾT BỊ / HỆ THỐNG', value: exp.productsSold.join(', ') || null },
                  { label: 'MÔI TRƯỜNG', value: exp.customerSegments.join(' / ') || null },
                  { label: 'MỨC ĐỘ TỰ CHỦ', value: autonomyLabel(exp.technicalAutonomyLevel) },
                ]
              : [
                  { label: 'NGÀNH', value: exp.industries.join(', ') || null },
                  { label: 'SẢN PHẨM', value: exp.productsSold.join(', ') || null },
                  { label: 'KHÁCH HÀNG', value: exp.customerSegments.join(' / ') || null },
                  { label: 'DOANH SỐ 12 THÁNG', value: formatRevenue(exp.latestRevenue) },
                ];
            const scopeText = (exp.jobDescription ?? '').trim();
            const fallbackStages = !scopeText && exp.sellingStages.length > 0 ? exp.sellingStages : [];
            const achievementText = (exp.bullets ?? '').trim();

            return (
              <div key={`${exp.company}-${idx}`} data-cv-block className="space-y-2">
                <p
                  className={clsx(
                    'flex flex-wrap items-baseline gap-x-1.5 font-bold leading-snug text-slate-900',
                    compact ? 'text-[9.5px]' : 'text-[11.5px]',
                  )}
                >
                  <span>{exp.role || (isTech ? 'Kỹ sư kỹ thuật' : 'Nhân viên kinh doanh')}</span>
                  {exp.company ? (
                    <>
                      <span className="font-normal text-slate-400">|</span>
                      <span className="text-[#0F766E]">{exp.company}</span>
                    </>
                  ) : null}
                  {exp.period ? (
                    <>
                      <span className="font-normal text-slate-400">|</span>
                      <span className="font-semibold text-slate-600">{exp.period}</span>
                    </>
                  ) : null}
                </p>

                <ExecMetricStrip items={expMetrics} compact={compact} maxCols={4} />

                {scopeText || fallbackStages.length > 0 ? (
                  <div className="pt-0.5">
                    <p
                      className={clsx(
                        'mb-1 font-bold uppercase tracking-[0.05em] text-[#0F766E]',
                        compact ? 'text-[8px]' : 'text-[9.5px]',
                      )}
                    >
                      {isTech ? 'CÔNG VIỆC KỸ THUẬT' : 'PHẠM VI CÔNG VIỆC'}
                    </p>
                    {scopeText ? (
                      <RichOrBullets text={scopeText} compact={compact} />
                    ) : (
                      <ul className="space-y-0.5 pl-4">
                        {fallbackStages.map((stage) => (
                          <li
                            key={stage}
                            className={clsx(
                              'list-disc leading-relaxed text-slate-700 marker:text-slate-400',
                              compact ? 'text-[9px]' : 'text-[10.5px]',
                            )}
                          >
                            {stage}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {achievementText ? (
                  <div
                    className={clsx(
                      'leading-relaxed text-slate-800',
                      compact ? 'text-[9px]' : 'text-[10.5px]',
                    )}
                  >
                    <span className="mr-1.5 font-bold uppercase tracking-[0.04em] text-[#0F766E]">
                      THÀNH TÍCH / KẾT QUẢ
                    </span>
                    <span className="font-semibold text-slate-900">
                      {achievementText.replace(/\r?\n+/g, ' · ')}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ),
    });
  }

  if (showDeepTable || techExtraTools.length > 0) {
    sections.push({
      key: 'deep-skills',
      title: isTech ? 'NĂNG LỰC KỸ THUẬT CHUYÊN SÂU' : 'NĂNG LỰC BÁN HÀNG CHUYÊN SÂU',
      content: (
        <div className="space-y-2.5">
          {showDeepTable ? (
            <div className="overflow-hidden rounded-md border border-slate-200/80">
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="bg-[#F1F5F9]">
                    {deepCols.map((col) => (
                      <th
                        key={col.key}
                        className={clsx(
                          'font-bold uppercase tracking-[0.04em] text-slate-500',
                          compact ? 'px-2 py-1.5 text-[7px]' : 'px-3 py-2 text-[8.5px]',
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {validExps.map((exp, idx) => (
                    <tr key={`deep-${exp.company}-${idx}`}>
                      {deepCols.map((col) => (
                        <td
                          key={col.key}
                          className={clsx(
                            'align-top font-semibold leading-snug text-slate-800',
                            compact ? 'px-2 py-1.5 text-[8.5px]' : 'px-3 py-2 text-[10px]',
                          )}
                        >
                          {col.get(exp) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {techExtraTools.length > 0 ? (
            <ExecMetricStrip items={techExtraTools} compact={compact} maxCols={2} />
          ) : null}
        </div>
      ),
    });
  }

  if (eduItems.length > 0) {
    sections.push({
      key: 'education',
      title: 'HỌC VẤN & CHỨNG CHỈ',
      content: <ExecMetricStrip items={eduItems} compact={compact} maxCols={5} />,
    });
  }

  if (conditionItems.length > 0) {
    sections.push({
      key: 'conditions',
      title: 'ĐIỀU KIỆN LÀM VIỆC',
      content: <ExecMetricStrip items={conditionItems} compact={compact} maxCols={isTech ? 5 : 4} />,
    });
  }

  if (aspirationItems.length > 0) {
    sections.push({
      key: 'aspirations',
      title: 'MONG MUỐN & MÔI TRƯỜNG PHÙ HỢP',
      content: <ExecMetricStrip items={aspirationItems} compact={compact} maxCols={4} />,
    });
  }

  return (
    <div className="bg-white text-slate-900">
      <header
        data-cv-block
        style={{ backgroundColor: template.accent }}
        className={clsx(
          'text-white',
          compact ? 'px-3.5 py-3' : 'px-7 py-5',
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            {avatarUrl ? (
              <div
                className={clsx(
                  'shrink-0 overflow-hidden rounded-xl border-2 border-white/35 bg-white/10',
                  compact ? 'h-11 w-11' : 'h-[66px] w-[66px]',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={draft.fullName || 'Ảnh ứng viên'}
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <AvatarPhoto name={draft.fullName} src={null} compact={compact} dark />
            )}
            <div className="min-w-0">
              <h1
                className={clsx(
                  'truncate font-extrabold uppercase tracking-tight text-white',
                  compact ? 'text-sm leading-tight' : 'text-[22px] leading-tight',
                )}
              >
                {draft.fullName || 'HỌ VÀ TÊN'}
              </h1>
              <p
                className={clsx(
                  'mt-1 truncate font-bold uppercase tracking-[0.09em] text-white/85',
                  compact ? 'text-[8px]' : 'text-[10.5px]',
                )}
              >
                {subtitleText}
              </p>
            </div>
          </div>

          <div
            className={clsx(
              'shrink-0 space-y-0.5 text-right text-white/90',
              compact ? 'max-w-[44%] text-[8px]' : 'max-w-[42%] text-[10px]',
            )}
          >
            {draft.phone ? <p className="truncate">Di động: {draft.phone}</p> : null}
            {draft.email ? <p className="truncate">Email: {draft.email}</p> : null}
            {addressText ? <p className="truncate">Địa chỉ: {addressText}</p> : null}
          </div>
        </div>
      </header>

      <div className={clsx(compact ? 'space-y-3.5 px-3.5 py-3.5' : 'space-y-5 px-7 py-6')}>
        {sections.map((sec, idx) => (
          <section key={sec.key} data-cv-block className="space-y-2">
            <h2
              style={{ color: template.accent }}
              className={clsx(
                'flex items-center gap-2 font-extrabold uppercase tracking-[0.06em]',
                compact ? 'text-[9.5px]' : 'text-[11.5px]',
              )}
            >
              <span>{String(idx + 1).padStart(2, '0')}</span>
              <span>{sec.title}</span>
            </h2>
            {sec.content}
          </section>
        ))}
      </div>
    </div>
  );
}

export function CvPreview({
  draft,
  template,
  compact,
  empty,
  avatarUrl,
  /** Chiều rộng cố định cho PDF A4 (~794px @ 96dpi). */
  exportWidth,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  empty?: boolean;
  avatarUrl?: string | null;
  exportWidth?: number;
}) {
  if (empty) {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center gap-2 bg-white p-6 text-center',
          compact ? 'min-h-[160px]' : 'min-h-[320px]',
        )}
      >
        <Sparkles className={clsx(compact ? 'h-6 w-6' : 'h-8 w-8', 'text-brand-300')} />
        <p className="text-xs font-semibold text-slate-600">Chưa có nội dung CV</p>
        <p className="text-[11px] text-slate-400">
          Nạp từ hồ sơ hoặc phân tích AI để xem trước.
        </p>
      </div>
    );
  }

  const body =
    template.layout === 'executive' ? (
      <LayoutExecutive
        draft={draft}
        template={template}
        compact={compact}
        avatarUrl={avatarUrl}
      />
    ) : template.layout === 'classic' ? (
      <LayoutClassic
        draft={draft}
        template={template}
        compact={compact}
        avatarUrl={avatarUrl}
      />
    ) : template.layout === 'split' ? (
      <LayoutSplit
        draft={draft}
        template={template}
        compact={compact}
        avatarUrl={avatarUrl}
      />
    ) : (
      <LayoutSidebar
        draft={draft}
        template={template}
        compact={compact}
        avatarUrl={avatarUrl}
      />
    );

  return (
    <div
      className="overflow-hidden bg-white shadow-sm"
      style={
        exportWidth
          ? { width: exportWidth, minHeight: Math.round(exportWidth * 1.414) }
          : { minHeight: compact ? 280 : 420 }
      }
    >
      {body}
    </div>
  );
}
