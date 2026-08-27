'use client';

import clsx from 'clsx';
import { useState } from 'react';
import {
  EQUIPMENT_SYSTEM_OPTIONS,
  EQUIPMENT_SYSTEM_QUESTION,
  SALES_INDUSTRY_OPTIONS,
  TECHNICAL_AUTONOMY_LEVELS,
  TECHNICAL_AUTONOMY_QUESTION,
  TECHNICAL_WORK_TYPES,
  TECHNICAL_WORK_TYPES_QUESTION,
  TECHNICAL_HIGHLIGHTS_PLACEHOLDER,
  TECHNICAL_HIGHLIGHTS_QUESTION,
  WORK_ENVIRONMENT_ACTUAL_QUESTION,
  WORK_ENVIRONMENT_OPTIONS,
  type CvDraftFieldHint,
} from '@industriallink/contracts';
import { MonthYearRangeFields } from '@/components/ui';
import { CollapsibleFormSection } from '@/components/collapsible-form-section';
import { MatrixSection } from '@/components/matrix-section';
import { NumberedFieldLabel, NumberedTitle } from '@/components/numbered-field-label';
import { emptyCvExperience, type CvDraft } from '@/lib/cv-templates';

/** Tách chuỗi "03/2021 – 05/2024" (hoặc "2021 - Hiện tại") → YYYY-MM cho picker. */
function periodParts(period: string): { start: string; end: string; current: boolean } {
  const txt = period ?? '';
  const current = /hiện tại|nay|present|now/i.test(txt);
  const tokens = txt.match(/\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b/g) ?? [];
  const toIso = (token: string): string => {
    if (token.includes('/')) {
      const [m, y] = token.split('/');
      return `${y}-${String(Number(m)).padStart(2, '0')}`;
    }
    return `${token}-01`;
  };
  const start = tokens[0] ? toIso(tokens[0]) : '';
  const end = !current && tokens[1] ? toIso(tokens[1]) : '';
  return { start, end, current };
}

function isoToMmYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : '';
}

function composePeriod(start: string, end: string, current: boolean): string {
  const s = isoToMmYyyy(start);
  const e = current ? 'Hiện tại' : isoToMmYyyy(end);
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

const INDUSTRY_OPTIONS = [...SALES_INDUSTRY_OPTIONS, 'Khác'] as const;

function MultiCheck({
  options,
  selected,
  onChange,
  columns = 2,
  compact = true,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  columns?: 1 | 2 | 3;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className={clsx(
              'flex cursor-pointer rounded-lg border transition',
              compact
                ? 'items-center gap-1.5 whitespace-nowrap px-2 py-1 text-[12px] leading-tight'
                : 'items-start gap-2 px-3 py-2 text-sm',
              checked
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <input
              type="checkbox"
              className={clsx(
                'shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500',
                compact ? 'h-3.5 w-3.5' : 'mt-0.5 h-4 w-4',
              )}
              checked={checked}
              onChange={() => {
                if (checked) onChange(selected.filter((s) => s !== opt));
                else onChange([...selected, opt]);
              }}
            />
            <span className={compact ? 'min-w-0' : undefined}>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

/** MultiCheck + ô nhập "Khác: ___" (mục 28, 29). `searchable` = PDF mục 28. */
function MultiCheckWithCustom({
  options,
  selected,
  onChange,
  placeholder,
  searchable,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const customValues = selected.filter((s) => !options.includes(s));
  const q = query.trim().toLowerCase();
  const visibleOptions =
    searchable && q
      ? options.filter((o) => o.toLowerCase().includes(q) || selected.includes(o))
      : options;

  function addCustom() {
    const value = text.trim();
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
    setText('');
  }

  return (
    <div className="space-y-2">
      {searchable && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm thiết bị / hệ thống…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        />
      )}
      <MultiCheck options={visibleOptions} selected={selected} onChange={onChange} columns={2} />
      {customValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customValues.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s !== v))}
                className="font-bold text-brand-500 hover:text-brand-700"
                aria-label={`Xoá ${v}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-1.5 text-sm">
        <span className="shrink-0 text-slate-600">Khác:</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder ?? 'Nhập thêm…'}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!text.trim()}
          className="shrink-0 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
        >
          Thêm
        </button>
      </div>
    </div>
  );
}

function FieldLabel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return <NumberedFieldLabel title={title} description={description} />;
}

/**
 * D. Kinh nghiệm công ty (24–32) theo ma trận Kỹ thuật —
 * mỗi công ty một khối; công ty thứ 2 trở đi lặp lại 24–32.
 * Mục 30 (công việc kỹ thuật) và 31 (mức tự chủ) lưu chung ở cấp hồ sơ.
 */
export function CvTechnicalExperienceFields({
  draft,
  onChange,
  hint,
}: {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
  hint?: CvDraftFieldHint;
}) {
  const experiences = (draft.experience.length ? draft.experience : [emptyCvExperience()]).map(
    (e, i) => {
      if (
        i === 0 &&
        e.sellingStages.length === 0 &&
        draft.technicalWorkTypes.length > 0
      ) {
        return { ...e, sellingStages: [...draft.technicalWorkTypes] };
      }
      return e;
    },
  );
  const [expandedExp, setExpandedExp] = useState<Set<number>>(() => new Set([0]));

  function toggleExp(index: number, open: boolean) {
    setExpandedExp((prev) => {
      const next = new Set(prev);
      if (open) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  function updateExperience(index: number, patch: Partial<CvDraft['experience'][number]>) {
    onChange(
      'experience',
      experiences.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  return (
    <MatrixSection
      title="D. Kinh nghiệm công ty (24–32)"
      subtitle="Mỗi công ty một khối — công ty thứ 2 trở đi lặp lại các mục 24–32."
      extra={
        hint?.status === 'missing' ? (
          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
            Thiếu
          </span>
        ) : null
      }
    >
      {experiences.map((exp, index) => {
        const parts = periodParts(exp.period);
        const companyTitle = exp.company.trim()
          ? `${exp.company}${exp.role.trim() ? ` · ${exp.role}` : ''}`
          : 'Bấm để điền các mục 24–32';
        return (
          <CollapsibleFormSection
            key={`exp-${index}`}
            variant="company"
            title={`Kinh nghiệm công ty ${index + 1}`}
            subtitle={companyTitle}
            open={expandedExp.has(index)}
            onOpenChange={(open) => toggleExp(index, open)}
            actions={
              draft.experience.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(
                      'experience',
                      draft.experience.filter((_, i) => i !== index),
                    );
                    setExpandedExp((prev) => {
                      const next = new Set<number>();
                      for (const i of prev) {
                        if (i < index) next.add(i);
                        else if (i > index) next.add(i - 1);
                      }
                      if (next.size === 0) next.add(0);
                      return next;
                    });
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Xoá
                </button>
              ) : undefined
            }
          >

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  <NumberedTitle text="24. Tên công ty" />
                </span>
                <input
                  value={exp.company}
                  onChange={(e) => updateExperience(index, { company: e.target.value })}
                  placeholder="Anh/chị từng làm việc tại công ty nào?"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  <NumberedTitle text="25. Vị trí" />
                </span>
                <input
                  value={exp.role}
                  onChange={(e) => updateExperience(index, { role: e.target.value })}
                  placeholder="Anh/chị làm vị trí gì tại công ty này?"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                />
              </label>
            </div>

            <div>
              <FieldLabel title="26. Thời gian làm việc" />
              <MonthYearRangeFields
                start={parts.start}
                end={parts.end}
                current={parts.current}
                onStartChange={(v) =>
                  updateExperience(index, {
                    period: composePeriod(v, parts.end, parts.current),
                  })
                }
                onEndChange={(v) =>
                  updateExperience(index, {
                    period: composePeriod(parts.start, v, false),
                  })
                }
                onCurrentChange={(checked) =>
                  updateExperience(index, {
                    period: composePeriod(parts.start, '', checked),
                  })
                }
              />
            </div>

            <div>
              <FieldLabel
                title="27. Lĩnh vực đã làm"
                description="Anh/chị làm trong lĩnh vực nào tại công ty này?"
              />
              <MultiCheck
                options={INDUSTRY_OPTIONS}
                selected={exp.industries}
                onChange={(v) => updateExperience(index, { industries: v })}
                columns={2}
                compact
              />
            </div>

            <div>
              <FieldLabel
                title="28. Thiết bị / hệ thống đã làm"
                description={EQUIPMENT_SYSTEM_QUESTION}
              />
              <MultiCheckWithCustom
                options={EQUIPMENT_SYSTEM_OPTIONS}
                selected={exp.productsSold}
                onChange={(v) => updateExperience(index, { productsSold: v })}
                placeholder="VD: Lò hơi công nghiệp…"
                searchable
              />
            </div>

            <div>
              <FieldLabel
                title="29. Môi trường làm việc thực tế"
                description={WORK_ENVIRONMENT_ACTUAL_QUESTION}
              />
              <MultiCheckWithCustom
                options={WORK_ENVIRONMENT_OPTIONS}
                selected={exp.customerSegments}
                onChange={(v) => updateExperience(index, { customerSegments: v })}
                placeholder="VD: Trạm điện, mỏ…"
              />
            </div>

            <div>
              <FieldLabel
                title="30. Công việc kỹ thuật đã thực hiện"
                description={TECHNICAL_WORK_TYPES_QUESTION}
              />
              <MultiCheck
                options={TECHNICAL_WORK_TYPES}
                selected={exp.sellingStages}
                onChange={(v) => {
                  const nextExp = experiences.map((e, i) =>
                    i === index ? { ...e, sellingStages: v } : e,
                  );
                  onChange('experience', nextExp);
                  onChange(
                    'technicalWorkTypes',
                    [...new Set(nextExp.flatMap((e) => e.sellingStages))],
                  );
                }}
                columns={2}
              />
            </div>

            <div>
              <FieldLabel
                title="31. Mức độ tự chủ"
                description={TECHNICAL_AUTONOMY_QUESTION}
              />
              <div className="space-y-1.5">
                {TECHNICAL_AUTONOMY_LEVELS.map((lv) => {
                  const checked = draft.technicalAutonomyLevel === lv.value;
                  return (
                    <label
                      key={lv.value}
                      className={clsx(
                        'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                        checked
                          ? 'border-brand-300 bg-brand-50 text-brand-900'
                          : 'border-slate-200 bg-white text-slate-700',
                      )}
                    >
                      <input
                        type="radio"
                        name={`cv-technicalAutonomy-${index}`}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={checked}
                        onChange={() => onChange('technicalAutonomyLevel', lv.value)}
                      />
                      <span>{lv.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel
                title="32. Thành tích/dự án nổi bật"
                description={TECHNICAL_HIGHLIGHTS_QUESTION}
              />
              <textarea
                rows={3}
                value={exp.bullets}
                onChange={(e) => {
                  const value = e.target.value;
                  updateExperience(index, { bullets: value });
                  if (index === 0) onChange('salesHighlights', value);
                }}
                placeholder={TECHNICAL_HIGHLIGHTS_PLACEHOLDER}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-brand-500/30 focus:ring-2"
              />
            </div>
          </CollapsibleFormSection>
        );
      })}

      <button
        type="button"
        onClick={() => {
          const next = [...experiences, emptyCvExperience()];
          onChange('experience', next);
          setExpandedExp((prev) => new Set(prev).add(next.length - 1));
        }}
        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        + Thêm công ty (lặp lại mục 24–32)
      </button>
    </MatrixSection>
  );
}
