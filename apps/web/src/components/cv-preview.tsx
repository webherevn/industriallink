'use client';

import clsx from 'clsx';
import { Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  B2B_EXPERIENCE_BAND_LABEL,
  DEAL_TYPE_LABEL,
  JOB_READINESS_LABEL,
  TRAVEL_ABILITY_LABEL,
} from '@industriallink/contracts';
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
  return text
    .split(/\n|•|·|;/)
    .map((s) => s.replace(/^[-–—*]\s*/, '').trim())
    .filter(Boolean);
}

function formatRevenue(v: number | null | undefined): string | null {
  if (v == null) return null;
  return formatVndAmount(v);
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
}: {
  exp: CvDraft['experience'][number];
  accent: string;
  compact?: boolean;
}) {
  const bullets = bulletLines(exp.bullets);
  const meta: string[] = [];
  if (exp.industries.length) meta.push(exp.industries.slice(0, 3).join(', '));
  if (exp.productsSold.length) meta.push(`SP: ${exp.productsSold.slice(0, 4).join(', ')}`);
  if (exp.customerSegments.length) {
    meta.push(`KH: ${exp.customerSegments.slice(0, 3).join(', ')}`);
  }
  if (exp.marketsCovered.length) {
    meta.push(`TT: ${exp.marketsCovered.slice(0, 3).join(', ')}`);
  }
  const rev = formatRevenue(exp.latestRevenue);
  if (rev) meta.push(`DS: ${rev}`);
  if (exp.kpiAchievementPct != null) meta.push(`KPI: ${Math.round(exp.kpiAchievementPct)}%`);
  if (exp.newCustomerRatioPct != null) {
    meta.push(`KH mới: ${Math.round(exp.newCustomerRatioPct)}%`);
  }
  const deal = labelOf(DEAL_TYPE_LABEL, exp.dealType);
  if (deal) meta.push(deal);

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
      {meta.length > 0 && (
        <p className="mt-1 text-[9px] leading-snug text-slate-500">{meta.join(' · ')}</p>
      )}
      {exp.sellingStages.length > 0 && (
        <p className="mt-0.5 text-[9px] font-medium text-slate-500">
          Chu trình: {exp.sellingStages.join(' → ')}
        </p>
      )}
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
  const has =
    draft.productsSold.length > 0 ||
    draft.customerSegments.length > 0 ||
    draft.marketsCovered.length > 0 ||
    draft.industriesExperienced.length > 0 ||
    draft.b2bExperienceBand ||
    draft.dealType ||
    draft.typicalDealValue != null ||
    draft.maxDealValue != null ||
    draft.newCustomerRatioPct != null ||
    draft.salesHighlights;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle title="Năng lực Sales B2B" accent={accent} classic={classic} />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {draft.industriesExperienced.length > 0 && (
          <Kv label="Ngành" value={draft.industriesExperienced.join(', ')} />
        )}
        {draft.b2bExperienceBand && (
          <Kv
            label="Kinh nghiệm B2B"
            value={labelOf(B2B_EXPERIENCE_BAND_LABEL, draft.b2bExperienceBand)}
          />
        )}
        {draft.productsSold.length > 0 && (
          <Kv label="Sản phẩm" value={draft.productsSold.join(', ')} />
        )}
        {draft.customerSegments.length > 0 && (
          <Kv label="Tệp KH" value={draft.customerSegments.join(', ')} />
        )}
        {draft.marketsCovered.length > 0 && (
          <Kv label="Thị trường" value={draft.marketsCovered.join(', ')} />
        )}
        {draft.dealType && (
          <Kv label="Loại deal" value={labelOf(DEAL_TYPE_LABEL, draft.dealType)} />
        )}
        {draft.typicalDealValue != null && (
          <Kv label="Deal điển hình" value={formatRevenue(draft.typicalDealValue)} />
        )}
        {draft.maxDealValue != null && (
          <Kv label="Deal lớn nhất" value={formatRevenue(draft.maxDealValue)} />
        )}
        {draft.newCustomerRatioPct != null && (
          <Kv
            label="KH tự phát triển"
            value={`${Math.round(draft.newCustomerRatioPct)}%`}
          />
        )}
      </div>
      {draft.salesHighlights && !draft.summary && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{draft.salesHighlights}</p>
      )}
    </section>
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
  const readiness = labelOf(JOB_READINESS_LABEL, draft.jobReadiness);
  const availability = labelOf(AVAILABILITY_BAND_LABEL, draft.availabilityBand);
  const travel = labelOf(TRAVEL_ABILITY_LABEL, draft.travelAbility);
  const license =
    draft.hasB2License == null
      ? null
      : draft.hasB2License
        ? `Có${draft.driverLicenseType ? ` (${draft.driverLicenseType})` : ''}`
        : 'Không';
  const salaryBits = [
    draft.expectedSalaryMin != null ? `Từ ${formatVndAmount(draft.expectedSalaryMin)}` : null,
    draft.expectedOte != null ? `OTE ${formatVndAmount(draft.expectedOte)}` : null,
  ].filter(Boolean);
  const has =
    readiness ||
    availability ||
    travel ||
    license ||
    salaryBits.length > 0 ||
    draft.desiredLocations.length > 0 ||
    draft.languages.length > 0;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle title="Điều kiện công việc" accent={accent} classic={classic} />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <Kv label="Tìm việc" value={readiness} />
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
          value={draft.languages.length ? draft.languages.join(', ') : null}
        />
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
    draft.salesBehavior ||
    draft.careerMotivations.length > 0 ||
    draft.careerOrientations.length > 0 ||
    draft.workStyles.length > 0 ||
    draft.desiredPositions.length > 0;

  if (!has) return null;

  return (
    <section data-cv-block className="mb-3">
      <SectionTitle title="Định hướng & sở thích nghề" accent={accent} classic={classic} />
      <div className="space-y-2">
        {draft.desiredPositions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Vị trí mong muốn
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.desiredPositions.map((p) => (
                <Chip key={p}>{p}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.salesBehavior && (
          <Kv label="Phong cách & hành vi Sales" value={draft.salesBehavior} />
        )}
        {draft.careerMotivations.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Động lực nghề nghiệp
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.careerMotivations.map((m) => (
                <Chip key={m}>{m}</Chip>
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
              {draft.careerOrientations.map((o) => (
                <Chip key={o}>{o}</Chip>
              ))}
            </div>
          </div>
        )}
        {draft.workStyles.length > 0 && (
          <div>
            <p className="mb-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Phù hợp văn hóa
            </p>
            <ul className="space-y-1 pl-3.5">
              {draft.workStyles.map((w) => (
                <li
                  key={w}
                  className="list-disc text-[10px] leading-snug text-slate-700 marker:text-slate-400"
                >
                  {w}
                </li>
              ))}
            </ul>
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
      {(draft.summary || draft.salesHighlights) && (
        <section data-cv-block className="mb-4">
          <SectionTitle title="Giới thiệu" accent={accent} classic={classic} />
          <p className="text-[10.5px] leading-relaxed text-slate-700">
            {draft.summary || draft.salesHighlights}
          </p>
          {draft.summary && draft.salesHighlights && draft.salesHighlights !== draft.summary && (
            <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-[10px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
              <span className="font-bold text-slate-800">Nổi bật Sales: </span>
              {draft.salesHighlights}
            </p>
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
            {draft.certificates.map((c) => (
              <li key={c} className="list-disc text-[10px] text-slate-700 marker:text-slate-400">
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
            {draft.skills.slice(0, 14).map((s) => (
              <Chip key={s} dark={dark}>
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
            {draft.softSkills.slice(0, 6).map((s) => (
              <li
                key={s}
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
            {draft.languages.map((l) => (
              <Chip key={l} dark={dark}>
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
      {draft.location && (
        <p className={cls}>
          <MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-80" />
          {draft.location}
        </p>
      )}
      {draft.birthYear != null && (
        <p className={cls}>Năm sinh: {draft.birthYear}</p>
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
              {[...draft.skills, ...draft.softSkills].slice(0, 20).map((s) => (
                <Chip key={s}>{s}</Chip>
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
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 bg-white p-6 text-center">
        <Sparkles className="h-8 w-8 text-brand-300" />
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
