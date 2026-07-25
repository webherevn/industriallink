'use client';

import clsx from 'clsx';
import { Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
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

function Chip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-block rounded px-1.5 py-0.5 text-[9px] font-medium leading-tight',
        dark ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
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
      <div className="mb-2 border-b pb-1" style={{ borderColor: accent }}>
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ color: accent }}
        >
          {title}
        </h3>
      </div>
    );
  }
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: accent }} />
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-800">
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

  return (
    <div className={clsx('mb-3', compact && 'mb-2')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-[11px] font-bold text-slate-900">
          {exp.role}
          <span className="font-semibold text-slate-600"> · {exp.company}</span>
        </p>
        {exp.period ? (
          <p className="shrink-0 text-[9px] font-medium text-slate-500">{exp.period}</p>
        ) : null}
      </div>
      {meta.length > 0 && (
        <p className="mt-0.5 text-[9px] leading-snug text-slate-500">{meta.join(' · ')}</p>
      )}
      {exp.sellingStages.length > 0 && (
        <p className="mt-0.5 text-[9px] text-slate-500">
          Chu trình: {exp.sellingStages.join(' → ')}
        </p>
      )}
      {bullets.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-3.5">
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
      {(exp.productsSold.length > 0 || exp.customerSegments.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {exp.productsSold.slice(0, 6).map((p) => (
            <Chip key={p}>{p}</Chip>
          ))}
        </div>
      )}
      {/* accent unused visually here but kept for future bar accents */}
      <span className="sr-only" style={{ color: accent }} />
    </div>
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
        <section className="mb-3">
          <SectionTitle title="Giới thiệu" accent={accent} classic={classic} />
          <p className="text-[10px] leading-relaxed text-slate-700">
            {draft.summary || draft.salesHighlights}
          </p>
        </section>
      )}

      {draft.desiredPositions.length > 0 && (
        <section className="mb-3">
          <SectionTitle title="Vị trí mong muốn" accent={accent} classic={classic} />
          <div className="flex flex-wrap gap-1">
            {draft.desiredPositions.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
        </section>
      )}

      <section className="mb-3">
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

      {(draft.productsSold.length > 0 ||
        draft.customerSegments.length > 0 ||
        draft.marketsCovered.length > 0) && (
        <section className="mb-3">
          <SectionTitle title="Năng lực Sales B2B" accent={accent} classic={classic} />
          <div className="space-y-1.5 text-[10px] text-slate-700">
            {draft.productsSold.length > 0 && (
              <p>
                <span className="font-semibold text-slate-800">Sản phẩm: </span>
                {draft.productsSold.join(', ')}
              </p>
            )}
            {draft.customerSegments.length > 0 && (
              <p>
                <span className="font-semibold text-slate-800">Tệp KH: </span>
                {draft.customerSegments.join(', ')}
              </p>
            )}
            {draft.marketsCovered.length > 0 && (
              <p>
                <span className="font-semibold text-slate-800">Thị trường: </span>
                {draft.marketsCovered.join(', ')}
              </p>
            )}
          </div>
        </section>
      )}

      {draft.education.length > 0 && (
        <section className="mb-3">
          <SectionTitle title="Học vấn" accent={accent} classic={classic} />
          {draft.education.map((e, i) => (
            <div key={`${e.school}-${i}`} className="mb-1.5">
              <p className="text-[11px] font-bold text-slate-900">{e.school || e.degree}</p>
              <p className="text-[10px] text-slate-600">
                {[e.degree, e.period].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </section>
      )}

      {draft.projects.length > 0 && (
        <section className="mb-3">
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
        <section className="mb-1">
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
  return (
    <div className="space-y-3">
      {draft.skills.length > 0 && (
        <div>
          <p
            className={clsx(
              'mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]',
              dark ? 'text-white/70' : 'text-slate-500',
            )}
          >
            Kỹ năng
          </p>
          <div className="flex flex-wrap gap-1">
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
          <p
            className={clsx(
              'mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]',
              dark ? 'text-white/70' : 'text-slate-500',
            )}
          >
            Điểm mạnh
          </p>
          <ul className="space-y-0.5">
            {draft.softSkills.slice(0, 6).map((s) => (
              <li
                key={s}
                className={clsx('text-[10px] leading-snug', dark ? 'text-white/90' : 'text-slate-700')}
              >
                · {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {draft.languages.length > 0 && (
        <div>
          <p
            className={clsx(
              'mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em]',
              dark ? 'text-white/70' : 'text-slate-500',
            )}
          >
            Ngoại ngữ
          </p>
          <div className="flex flex-wrap gap-1">
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
    </div>
  );
}

function LayoutSidebar({
  draft,
  template,
  compact,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
}) {
  return (
    <div className="flex min-h-full bg-white text-slate-800">
      <aside
        className={clsx('shrink-0 text-white', compact ? 'w-[34%] p-3' : 'w-[32%] p-4')}
        style={{ backgroundColor: template.accent }}
      >
        <div
          className={clsx(
            'flex items-center justify-center rounded-full bg-white/20 font-bold tracking-wide',
            compact ? 'h-12 w-12 text-sm' : 'mx-auto h-16 w-16 text-lg',
          )}
        >
          {initials(draft.fullName)}
        </div>
        <p
          className={clsx(
            'mt-3 font-extrabold leading-tight tracking-tight',
            compact ? 'text-[12px]' : 'text-center text-[14px]',
          )}
        >
          {draft.fullName || 'HỌ VÀ TÊN'}
        </p>
        <p
          className={clsx(
            'mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/80',
            !compact && 'text-center',
          )}
        >
          {draft.title || 'Vị trí ứng tuyển'}
        </p>
        <div className="my-3 h-px bg-white/20" />
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/70">
          Liên hệ
        </p>
        <ContactLines draft={draft} dark />
        <div className="my-3 h-px bg-white/20" />
        <SidebarSkills draft={draft} dark />
      </aside>
      <div className={clsx('min-w-0 flex-1', compact ? 'p-3' : 'p-5')}>
        <MainSections draft={draft} accent={template.accent} compact={compact} />
      </div>
    </div>
  );
}

function LayoutClassic({
  draft,
  template,
  compact,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx('min-h-full bg-white text-slate-800', compact ? 'p-3' : 'p-6')}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="border-b-2 pb-3" style={{ borderColor: template.accent }}>
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
      </header>
      <div className="mt-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <MainSections draft={draft} accent={template.accent} classic compact={compact} />
        {(draft.skills.length > 0 || draft.languages.length > 0) && (
          <section className="mt-2">
            <SectionTitle title="Kỹ năng & ngoại ngữ" accent={template.accent} classic />
            <div className="flex flex-wrap gap-1">
              {[...draft.skills, ...draft.languages].slice(0, 18).map((s) => (
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
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
}) {
  return (
    <div className="min-h-full bg-white text-slate-800">
      <header
        className={clsx('text-white', compact ? 'px-3 py-3' : 'px-5 py-4')}
        style={{ backgroundColor: template.accent }}
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className={clsx('font-extrabold tracking-tight', compact ? 'text-base' : 'text-xl')}>
              {draft.fullName || 'HỌ VÀ TÊN'}
            </h1>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85">
              {draft.title || 'Vị trí ứng tuyển'}
            </p>
          </div>
          <div className="max-w-[45%] text-right">
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
  /** Chiều rộng cố định cho PDF A4 (~794px @ 96dpi). */
  exportWidth,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  empty?: boolean;
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
      <LayoutClassic draft={draft} template={template} compact={compact} />
    ) : template.layout === 'split' ? (
      <LayoutSplit draft={draft} template={template} compact={compact} />
    ) : (
      <LayoutSidebar draft={draft} template={template} compact={compact} />
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
