'use client';

import clsx from 'clsx';
import { Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  B2B_EXPERIENCE_BAND_LABEL,
  JobTrack,
  TRACK_FIELD_LABELS,
  TRAVEL_ABILITY_LABEL,
  TECHNICAL_AUTONOMY_LEVELS,
  SHIFT_FLEXIBILITY_OPTIONS,
  formatDealTypes,
  formatLanguageSkillSummary,
  formatVnAddress,
} from '@industriallink/contracts';
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

function bulletLines(text: string): string[] {
  return toBulletLines(text);
}

function formatRevenue(v: number | null | undefined): string | null {
  if (v == null) return null;
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

function Chip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={clsx(
        // py không đều: bù metric font VN (dấu trên) để chữ nằm giữa nền
        'inline-flex max-w-full items-center justify-center rounded-md px-2.5 pt-[5px] pb-[7px]',
        'text-[9.5px] font-semibold leading-none',
        dark
          ? 'bg-white text-slate-800 shadow-sm'
          : 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80',
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
  const size = compact ? 'h-14 w-14 text-sm' : 'h-[72px] w-[72px] text-lg';
  return (
    <div
      className={clsx(
        'mx-auto flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold tracking-wide ring-2',
        size,
        dark
          ? 'bg-white/20 text-white ring-white/40'
          : 'bg-slate-100 text-slate-600 ring-slate-200',
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function Kv({
  label,
  value,
  dark,
}: {
  label: string;
  value: ReactNode;
  dark?: boolean;
}) {
  if (value == null || value === '' || value === false) return null;
  return (
    <div
      className={clsx(
        'flex min-h-[44px] flex-col justify-center rounded-md px-2.5 pt-[7px] pb-[9px]',
        dark ? 'bg-white/10' : 'bg-slate-50 ring-1 ring-slate-100',
      )}
    >
      <p
        className={clsx(
          'text-[8.5px] font-bold uppercase leading-none tracking-[0.08em]',
          dark ? 'text-white/65' : 'text-slate-500',
        )}
      >
        {label}
      </p>
      <p
        className={clsx(
          'mt-1.5 text-[10px] font-medium leading-snug',
          dark ? 'text-white' : 'text-slate-800',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  title,
  accent,
  classic,
}: {
  title: string;
  accent: string;
  classic?: boolean;
}) {
  if (classic) {
    return (
      <div className="mb-2.5 border-b-2 pb-1.5" style={{ borderColor: accent }}>
        <h3
          className="text-[11px] font-extrabold uppercase leading-none tracking-[0.14em]"
          style={{ color: accent }}
        >
          {title}
        </h3>
      </div>
    );
  }
  // Icon absolute theo cap-height chữ (không flex-center theo line-box → tránh lệch cao)
  return (
    <div className="relative mb-2.5 pl-[11px]">
      <span
        aria-hidden
        className="absolute left-0 top-[1px] block h-[10px] w-[5px] rounded-[2px]"
        style={{ backgroundColor: accent }}
      />
      <h3
        className="text-[11px] font-extrabold uppercase leading-none tracking-[0.1em]"
        style={{ color: accent }}
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
  const bullets = bulletLines(exp.bullets);

  const detailRows: { label: string; value: string }[] = [];
  if (exp.industries.length) {
    detailRows.push({
      label: 'Lĩnh vực',
      value: exp.industries.slice(0, 5).join(', '),
    });
  }
  if (exp.productsSold.length) {
    detailRows.push({
      label: isTech ? 'Thiết bị / hệ thống' : 'Sản phẩm',
      value: exp.productsSold.slice(0, 6).join(', '),
    });
  }
  if (!isTech && (exp.brandsTechnologies?.length ?? 0) > 0) {
    detailRows.push({
      label: 'Hãng / thương hiệu',
      value: (exp.brandsTechnologies ?? []).slice(0, 8).join(', '),
    });
  }
  if (exp.customerSegments.length) {
    detailRows.push({
      label: isTech ? 'Môi trường' : 'Khách hàng',
      value: exp.customerSegments.slice(0, 5).join(', '),
    });
  }
  if (exp.marketsCovered.length && !isTech) {
    detailRows.push({
      label: 'Thị trường',
      value: exp.marketsCovered.slice(0, 5).join(', '),
    });
  }
  if (!isTech) {
    const deal = formatDealTypes(exp.dealType);
    if (deal) detailRows.push({ label: 'Giải pháp sản phẩm', value: deal });
    const rev = formatRevenue(exp.latestRevenue);
    if (rev) detailRows.push({ label: 'Doanh số 12 tháng', value: rev });
    const kpi = kpiBandLabel(exp.kpiAchievementPct);
    if (kpi) detailRows.push({ label: 'Hoàn thành KPI', value: kpi });
    const ratio = newCustomerBandLabel(exp.newCustomerRatioPct);
    if (ratio) detailRows.push({ label: 'KH tự tìm kiếm', value: ratio });
    const dealValue = dealValueBandLabel(exp.typicalDealValue);
    if (dealValue) detailRows.push({ label: 'Giá trị hợp đồng', value: dealValue });
  }

  return (
    <div
      data-cv-block
      className={clsx(
        'mb-4 border-b border-slate-100 pb-3 last:mb-0 last:border-0 last:pb-0',
        compact && 'mb-3 pb-2.5',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-[11.5px] font-extrabold leading-tight text-slate-900">
          {exp.role}
        </p>
        {exp.period ? (
          <p className="inline-flex shrink-0 items-center justify-center rounded bg-slate-100 px-1.5 pt-[3px] pb-[5px] text-[9px] font-bold leading-none text-slate-600">
            {exp.period}
          </p>
        ) : null}
      </div>
      <p className="mt-0.5 text-[10.5px] font-semibold" style={{ color: accent }}>
        {exp.company}
      </p>
      {detailRows.length > 0 && (
        <dl className="mt-1.5 space-y-0.5">
          {detailRows.map((row) => (
            <div key={row.label} className="flex gap-1 text-[9px] leading-snug">
              <dt className="shrink-0 font-bold text-slate-600">{row.label}:</dt>
              <dd className="min-w-0 text-slate-500">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {exp.sellingStages.length > 0 && (
        <p className="mt-1 text-[9px] leading-snug text-slate-500">
          <span className="font-bold text-slate-600">
            {isTech ? 'Công việc' : 'Phạm vi công việc'}:
          </span>{' '}
          {exp.sellingStages.join(' · ')}
        </p>
      )}
      {!isTech && (exp.jobDescription ?? '').trim() ? (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-700">
          {(exp.jobDescription ?? '').trim()}
        </p>
      ) : null}
      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1 pl-3.5">
          {bullets.map((b, i) => (
            <li
              key={`${i}-${b.slice(0, 24)}`}
              className="list-disc text-[10px] leading-relaxed text-slate-700 marker:text-slate-400"
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SalesCapabilitySection({
  draft,
  accent,
  classic,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
}) {
  const isTech = draft.jobTrack === JobTrack.Technical;
  const productLabel = isTech
    ? TRACK_FIELD_LABELS.productsSold[JobTrack.Technical]
    : TRACK_FIELD_LABELS.productsSold[JobTrack.Sales];
  const segmentLabel = isTech
    ? TRACK_FIELD_LABELS.customerSegments[JobTrack.Technical]
    : TRACK_FIELD_LABELS.customerSegments[JobTrack.Sales];
  const highlightLabel = TRACK_FIELD_LABELS.salesHighlights[JobTrack.Sales];

  const autonomy =
    draft.technicalAutonomyLevel != null
      ? TECHNICAL_AUTONOMY_LEVELS.find((l) => l.value === draft.technicalAutonomyLevel)?.label
      : null;

  const workTypes = draft.technicalWorkTypes.length
    ? draft.technicalWorkTypes
    : draft.experience.flatMap((e) => e.sellingStages);
  const uniqueWorkTypes = [...new Set(workTypes)];
  const equipment = draft.productsSold.length
    ? draft.productsSold
    : draft.experience.flatMap((e) => e.productsSold);
  const uniqueEquipment = [...new Set(equipment)];
  const environments = draft.customerSegments.length
    ? draft.customerSegments
    : draft.experience.flatMap((e) => e.customerSegments);
  const uniqueEnvironments = [...new Set(environments)];

  const has = isTech
    ? uniqueEquipment.length > 0 ||
      uniqueEnvironments.length > 0 ||
      draft.industriesExperienced.length > 0 ||
      uniqueWorkTypes.length > 0 ||
      draft.technicalTools.length > 0 ||
      draft.documentLiteracy.length > 0 ||
      draft.desiredWorkEnvironments.length > 0 ||
      !!autonomy
    : uniqueEquipment.length > 0 ||
      uniqueEnvironments.length > 0 ||
      draft.marketsCovered.length > 0 ||
      draft.industriesExperienced.length > 0 ||
      !!draft.b2bExperienceBand ||
      !!draft.dealType ||
      draft.typicalDealValue != null ||
      draft.newCustomerRatioPct != null ||
      !!draft.salesHighlights ||
      draft.brandsTechnologies.length > 0;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle
        title={isTech ? 'Năng lực kỹ thuật' : 'Năng lực Sales B2B'}
        accent={accent}
        classic={classic}
      />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {draft.industriesExperienced.length > 0 && (
          <Kv label={isTech ? 'Lĩnh vực' : 'Ngành'} value={draft.industriesExperienced.join(', ')} />
        )}
        {!isTech && draft.b2bExperienceBand && (
          <Kv
            label="Kinh nghiệm B2B"
            value={labelOf(B2B_EXPERIENCE_BAND_LABEL, draft.b2bExperienceBand)}
          />
        )}
        {uniqueEquipment.length > 0 && (
          <Kv label={productLabel} value={uniqueEquipment.join(', ')} />
        )}
        {uniqueEnvironments.length > 0 && (
          <Kv label={segmentLabel} value={uniqueEnvironments.join(', ')} />
        )}
        {!isTech && draft.marketsCovered.length > 0 && (
          <Kv label="Thị trường" value={draft.marketsCovered.join(', ')} />
        )}
        {!isTech &&
          [
            ...new Set([
              ...draft.experience.flatMap((e) => e.brandsTechnologies ?? []),
              ...draft.brandsTechnologies,
            ]),
          ].length > 0 && (
          <Kv
            label="Hãng / thương hiệu"
            value={[
              ...new Set([
                ...draft.experience.flatMap((e) => e.brandsTechnologies ?? []),
                ...draft.brandsTechnologies,
              ]),
            ].join(', ')}
          />
        )}
        {isTech && uniqueWorkTypes.length > 0 && (
          <Kv label="Công việc kỹ thuật" value={uniqueWorkTypes.join(', ')} />
        )}
        {isTech && autonomy && (
          <Kv label="Mức tự chủ" value={autonomy} />
        )}
        {isTech && draft.technicalTools.length > 0 && (
          <Kv label="Phần mềm / công cụ" value={draft.technicalTools.join(', ')} />
        )}
        {isTech && draft.documentLiteracy.length > 0 && (
          <Kv label="Đọc bản vẽ / tài liệu" value={draft.documentLiteracy.join(', ')} />
        )}
        {isTech && draft.desiredWorkEnvironments.length > 0 && (
          <Kv
            label="Môi trường mong muốn"
            value={draft.desiredWorkEnvironments.join(', ')}
          />
        )}
        {!isTech && draft.dealType && (
          <Kv label="Giải pháp sản phẩm" value={formatDealTypes(draft.dealType)} />
        )}
        {!isTech && draft.typicalDealValue != null && (
          <Kv
            label="Giá trị hợp đồng thường gặp"
            value={dealValueBandLabel(draft.typicalDealValue)}
          />
        )}
        {!isTech && draft.newCustomerRatioPct != null && (
          <Kv
            label="KH tự tìm kiếm"
            value={newCustomerBandLabel(draft.newCustomerRatioPct)}
          />
        )}
      </div>
      {!isTech && draft.salesHighlights && (
        <div className="mt-2">
          <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
            {highlightLabel}
          </p>
          <SalesHighlightsBullets text={draft.salesHighlights} />
        </div>
      )}
    </section>
  );
}

function SalesHighlightsBullets({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = toBulletLines(text);
  if (lines.length === 0) return null;
  if (lines.length === 1) {
    return (
      <p className={clsx('text-[10px] leading-relaxed text-slate-600', className)}>
        {lines[0]}
      </p>
    );
  }
  return (
    <ul className={clsx('space-y-1 pl-3.5', className)}>
      {lines.map((line, i) => (
        <li
          key={`${i}-${line.slice(0, 24)}`}
          className="list-disc text-[10px] leading-relaxed text-slate-700 marker:text-slate-400"
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function ConditionsSection({
  draft,
  accent,
  classic,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
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
  const salaryBits = [
    draft.expectedSalaryMin != null ? `Từ ${formatVndAmount(draft.expectedSalaryMin)}` : null,
    draft.expectedOte != null ? `OTE ${formatVndAmount(draft.expectedOte)}` : null,
  ].filter(Boolean);
  const has =
    availability ||
    travel ||
    license ||
    salaryBits.length > 0 ||
    draft.desiredLocations.length > 0 ||
    draft.languages.length > 0 ||
    shift;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle title="Điều kiện công việc" accent={accent} classic={classic} />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <Kv label="Nhận việc" value={availability} />
        <Kv label="Công tác" value={travel} />
        <Kv label="Bằng lái" value={license} />
        <Kv label="Thu nhập kỳ vọng" value={salaryBits.join(' · ') || null} />
        <Kv
          label="Địa điểm mong muốn"
          value={draft.desiredLocations.length ? draft.desiredLocations.join(', ') : null}
        />
        <Kv
          label="Ngoại ngữ"
          value={
            draft.languageSkills?.length
              ? draft.languageSkills.map(formatLanguageSkillSummary).join('; ')
              : draft.languages.length
                ? draft.languages.join(', ')
                : null
          }
        />
        {shift && <Kv label="Làm ca / ngoài giờ" value={shift} />}
      </div>
    </section>
  );
}

/** Mục 36–39 + sở thích / định hướng nghề. */
function PreferencesSection({
  draft,
  accent,
  classic,
}: {
  draft: CvDraft;
  accent: string;
  classic?: boolean;
}) {
  const has =
    draft.hobbies.length > 0 ||
    draft.careerMotivations.length > 0 ||
    draft.careerOrientations.length > 0 ||
    draft.workStyles.length > 0 ||
    draft.desiredPositions.length > 0 ||
    draft.desiredWorkEnvironments.length > 0;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle title="Định hướng & sở thích" accent={accent} classic={classic} />
      <div className="space-y-2">
        {draft.hobbies.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Sở thích
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.hobbies.map((h, i) => (
                <Chip key={`hobby-${i}-${h}`}>{h}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.desiredPositions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Vị trí mong muốn
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.desiredPositions.map((p, i) => (
                <Chip key={`pos-${i}-${p}`}>{p}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.careerMotivations.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Động lực nghề nghiệp
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.careerMotivations.map((m, i) => (
                <Chip key={`mot-${i}-${m}`}>{m}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.careerOrientations.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Định hướng nghề nghiệp
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.careerOrientations.map((o, i) => (
                <Chip key={`ori-${i}-${o}`}>{o}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.workStyles.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              {draft.jobTrack === JobTrack.Technical
                ? 'Cách làm việc kỹ thuật'
                : 'Phong cách & môi trường làm việc'}
            </p>
            <ul className="space-y-1 pl-3.5">
              {draft.workStyles.map((w, i) => (
                <li
                  key={`ws-${i}-${w}`}
                  className="list-disc text-[10px] leading-snug text-slate-700 marker:text-slate-400"
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {draft.jobTrack === JobTrack.Technical &&
          draft.desiredWorkEnvironments.length > 0 && (
            <div>
              <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
                Môi trường làm việc mong muốn
              </p>
              <div className="flex flex-wrap gap-1.5">
                {draft.desiredWorkEnvironments.map((e, i) => (
                  <Chip key={`env-${i}-${e}`}>{e}</Chip>
                ))}
              </div>
            </div>
          )}
      </div>
    </section>
  );
}

function MainSections({
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
  return (
    <>
      {(draft.summary ||
        (draft.jobTrack !== JobTrack.Technical && draft.salesHighlights) ||
        draft.careerObjective) && (
        <section data-cv-block className="mb-4">
          <SectionTitle title="Giới thiệu" accent={accent} classic={classic} />
          {draft.careerObjective && (
            <p className="mb-2 whitespace-pre-line rounded-md bg-slate-50 px-2.5 py-2 text-[10px] leading-relaxed text-slate-700 ring-1 ring-slate-100">
              <span className="font-bold text-slate-800">Mục tiêu nghề nghiệp: </span>
              {draft.careerObjective}
            </p>
          )}
          {draft.summary ? (
            <p className="text-[10.5px] leading-relaxed text-slate-700">{draft.summary}</p>
          ) : null}
          {draft.jobTrack !== JobTrack.Technical &&
            draft.salesHighlights &&
            draft.salesHighlights !== draft.summary && (
              <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100">
                <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  {TRACK_FIELD_LABELS.salesHighlights[JobTrack.Sales]}
                </p>
                <SalesHighlightsBullets text={draft.salesHighlights} />
              </div>
            )}
        </section>
      )}

      <PreferencesSection draft={draft} accent={accent} classic={classic} />

      <section data-cv-block className="mb-4">
        <SectionTitle title="Kinh nghiệm làm việc" accent={accent} classic={classic} />
        {draft.experience.length === 0 ? (
          <p className="text-[10px] text-slate-400">Chưa có kinh nghiệm</p>
        ) : (
          draft.experience.map((e, i) => (
            <ExperienceBlock
              key={`${e.company}-${e.role}-${i}`}
              exp={e}
              accent={accent}
              compact={compact}
              jobTrack={draft.jobTrack}
            />
          ))
        )}
      </section>

      <SalesCapabilitySection draft={draft} accent={accent} classic={classic} />
      <ConditionsSection draft={draft} accent={accent} classic={classic} />

      {draft.education.length > 0 && (
        <section data-cv-block className="mb-3">
          <SectionTitle title="Học vấn" accent={accent} classic={classic} />
          {draft.education.map((e, i) => (
            <div key={`${e.school}-${i}`} className="mb-1.5">
              <p className="text-[11px] font-bold text-slate-900">{e.school || e.degree}</p>
              <p className="text-[10px] text-slate-600">
                {[draft.educationLevel, e.degree, e.period].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </section>
      )}

      {draft.projects.length > 0 && (
        <section data-cv-block className="mb-3">
          <SectionTitle title="Dự án tiêu biểu" accent={accent} classic={classic} />
          {draft.projects.map((p, i) => (
            <div key={`${p.name}-${i}`} className="mb-1.5">
              <p className="text-[11px] font-bold text-slate-900">{p.name}</p>
              {p.detail && (
                <p className="text-[10px] leading-relaxed text-slate-600">{p.detail}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {draft.certificates.length > 0 && (
        <section data-cv-block className="mb-1">
          <SectionTitle title="Chứng chỉ" accent={accent} classic={classic} />
          <ul className="space-y-0.5 pl-3.5">
            {draft.certificates.map((c, i) => (
              <li
                key={`cert-${i}-${c}`}
                className="list-disc text-[10px] text-slate-700 marker:text-slate-400"
              >
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SidebarSkills({
  draft,
  dark,
}: {
  draft: CvDraft;
  dark?: boolean;
}) {
  const heading = clsx(
    'mb-2 text-[9px] font-extrabold uppercase tracking-[0.14em]',
    dark ? 'text-white/80' : 'text-slate-500',
  );

  return (
    <div className="space-y-4">
      {draft.skills.length > 0 && (
        <div>
          <p className={heading}>Kỹ năng</p>
          <div className="flex flex-wrap gap-2">
            {draft.skills.slice(0, 14).map((s, i) => (
              <Chip key={`sk-${i}-${s}`} dark={dark}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {draft.softSkills.length > 0 && (
        <div>
          <p className={heading}>Điểm mạnh</p>
          <ul className="space-y-1">
            {draft.softSkills.slice(0, 6).map((s, i) => (
              <li
                key={`ss-${i}-${s}`}
                className={clsx(
                  'rounded-md px-2 pt-[5px] pb-[7px] text-[10px] font-medium leading-none',
                  dark ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-700',
                )}
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {draft.languages.length > 0 && (
        <div>
          <p className={heading}>Ngoại ngữ</p>
          <div className="flex flex-wrap gap-2">
            {draft.languages.map((l, i) => (
              <Chip key={`lang-${i}-${l}`} dark={dark}>
                {l}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContactLines({
  draft,
  dark,
}: {
  draft: CvDraft;
  dark?: boolean;
}) {
  const cls = clsx(
    'flex items-start gap-1.5 text-[9px] leading-snug',
    dark ? 'text-white/90' : 'text-slate-600',
  );
  return (
    <div className="space-y-1">
      {draft.email && (
        <p className={cls}>
          <Mail className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-80" />
          <span className="break-all">{draft.email}</span>
        </p>
      )}
      {draft.phone && (
        <p className={cls}>
          <Phone className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-80" />
          {draft.phone}
        </p>
      )}
      {formatVnAddress({
        ward: draft.ward,
        province: draft.location,
      }) && (
        <p className={cls}>
          <MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-80" />
          {formatVnAddress({
            ward: draft.ward,
            province: draft.location,
          })}
        </p>
      )}
      {(draft.birthDate || draft.birthYear != null) && (
        <p className={cls}>
          Ngày sinh:{' '}
          {draft.birthDate
            ? draft.birthDate.includes('-')
              ? draft.birthDate.split('-').reverse().join('/')
              : draft.birthDate
            : draft.birthYear}
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
        className={clsx('shrink-0 text-white', compact ? 'w-[34%] p-3' : 'w-[32%] p-4')}
        style={{ backgroundColor: template.accent }}
      >
        <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} dark />
        <p
          className={clsx(
            'mt-3 font-extrabold leading-tight tracking-tight',
            compact ? 'text-[12px]' : 'text-center text-[15px]',
          )}
        >
          {draft.fullName || 'HỌ VÀ TÊN'}
        </p>
        <p
          className={clsx(
            'mt-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/85',
            !compact && 'text-center',
          )}
        >
          {draft.title || 'Vị trí ứng tuyển'}
        </p>
        <div className="my-3.5 h-px bg-white/25" />
        <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/80">
          Liên hệ
        </p>
        <ContactLines draft={draft} dark />
        <div className="my-3.5 h-px bg-white/25" />
        <SidebarSkills draft={draft} dark />
      </aside>
      <div className={clsx('min-w-0 flex-1', compact ? 'p-3' : 'px-5 py-5')}>
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
      className={clsx('min-h-full bg-white text-slate-800', compact ? 'p-3' : 'p-6')}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="border-b-2 pb-3" style={{ borderColor: template.accent }}>
        <div className="flex items-start gap-4">
          <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} />
          <div className="min-w-0 flex-1">
            <h1
              className={clsx(
                'font-bold tracking-tight text-slate-900',
                compact ? 'text-base' : 'text-xl',
              )}
            >
              {draft.fullName || 'HỌ VÀ TÊN'}
            </h1>
            <p
              className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: template.accent, fontFamily: 'system-ui, sans-serif' }}
            >
              {draft.title || 'Vị trí ứng tuyển'}
            </p>
            <div className="mt-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <ContactLines draft={draft} />
            </div>
          </div>
        </div>
      </header>
      <div className="mt-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <MainSections draft={draft} accent={template.accent} classic compact={compact} />
        {(draft.skills.length > 0 || draft.softSkills.length > 0) && (
          <section className="mt-3">
            <SectionTitle title="Kỹ năng" accent={template.accent} classic />
            <div className="flex flex-wrap gap-1.5">
              {[...draft.skills, ...draft.softSkills].slice(0, 20).map((s, i) => (
                <Chip key={`chip-${i}-${s}`}>{s}</Chip>
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
        className={clsx('text-white', compact ? 'px-3 py-3' : 'px-5 py-4')}
        style={{ backgroundColor: template.accent }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarPhoto name={draft.fullName} src={avatarUrl} compact={compact} dark />
            <div className="min-w-0">
              <h1
                className={clsx('font-extrabold tracking-tight', compact ? 'text-base' : 'text-xl')}
              >
                {draft.fullName || 'HỌ VÀ TÊN'}
              </h1>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/85">
                {draft.title || 'Vị trí ứng tuyển'}
              </p>
            </div>
          </div>
          <div className="max-w-[40%] text-right">
            <ContactLines draft={draft} dark />
          </div>
        </div>
      </header>
      <div className={clsx('grid grid-cols-5 gap-0', compact ? 'p-3' : 'p-5')}>
        <div className="col-span-2 border-r border-slate-100 pr-3">
          <SidebarSkills draft={draft} />
          {draft.softSkills.length === 0 && draft.skills.length === 0 && (
            <p className="text-[10px] text-slate-400">Chưa có kỹ năng</p>
          )}
        </div>
        <div className="col-span-3 pl-3">
          <MainSections draft={draft} accent={template.accent} compact={compact} />
        </div>
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
    template.layout === 'classic' ? (
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
