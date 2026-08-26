'use client';

import clsx from 'clsx';
import {
  AVAILABILITY_BAND_LABEL,
  AVAILABILITY_QUESTION,
  AvailabilityBand,
  CAREER_MOTIVATIONS,
  CAREER_MOTIVATION_QUESTION,
  CAREER_ORIENTATIONS,
  CAREER_ORIENTATION_QUESTION,
  CULTURE_FIT_QUESTIONS,
  CULTURE_FIT_SECTION_TITLE,
  CULTURE_FIT_SUBTITLE,
  DESIRED_LOCATION_OPTIONS,
  EXPECTED_INCOME_QUESTION,
  cultureFitAnswersToWorkStyles,
  workStylesToCultureFitAnswers,
  type CultureFitQuestionId,
  type CvDraftFieldHint,
} from '@industriallink/contracts';
import { MoneyInput } from '@/components/ui';
import { NumberedFieldLabel } from '@/components/numbered-field-label';
import { filterCareerMotivations } from '@/lib/career-motivations';
import type { CvDraft } from '@/lib/cv-templates';

function MultiCheck({
  options,
  selected,
  onChange,
  max,
  columns = 2,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  columns?: 1 | 2 | 3;
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
        const disabled = !checked && max != null && selected.length >= max;
        return (
          <label
            key={opt}
            className={clsx(
              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
              checked
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : disabled
                  ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (checked) onChange(selected.filter((s) => s !== opt));
                else if (!disabled) onChange([...selected, opt]);
              }}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle?: string;
  hint?: CvDraftFieldHint;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-t border-slate-100 pt-5">
      <div>
        <h3 className="text-sm font-bold text-accent-600">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {hint ? (
        <span
          className={clsx(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
            hint.status === 'filled' && 'bg-emerald-50 text-emerald-700',
            hint.status === 'weak' && 'bg-amber-50 text-amber-700',
            hint.status === 'missing' && 'bg-rose-50 text-rose-600',
          )}
        >
          {hint.status === 'filled' ? 'OK' : hint.status === 'weak' ? 'Yếu' : 'Thiếu'}
        </span>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  description,
  value,
  onChange,
  options,
  emptyLabel = '— Chọn —',
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <label className="block">
      <NumberedFieldLabel title={label} description={description} className="mb-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Khối B/C theo ma trận 34 mục — chỉ hiện khi đã chọn hướng Kinh doanh.
 * B. Mong muốn nghề nghiệp (14–16; STT 13 nằm ở khối vị trí ứng tuyển phía trên)
 * C. Định hướng & phù hợp (17–19)
 * D. Kinh nghiệm công ty (20–34) nằm ở khối CvSalesExperienceFields phía sau.
 */
export function CvDraftMatrixFields({
  draft,
  fields,
  onChange,
}: {
  draft: CvDraft;
  fields: CvDraftFieldHint[];
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
}) {
  const cultureFit = workStylesToCultureFitAnswers(draft.workStyles);

  function patchCultureFit(id: CultureFitQuestionId, value: string) {
    const next = { ...cultureFit, [id]: value };
    onChange('workStyles', cultureFitAnswersToWorkStyles(next));
  }

  function hint(key: string) {
    return fields.find((f) => f.key === key);
  }

  const orientation = draft.careerOrientations[0] ?? '';
  const selectedMotivations = filterCareerMotivations(draft.careerMotivations, 'sales');

  return (
    <div className="space-y-5">
      <SectionTitle
        title="B. Mong muốn nghề nghiệp (14–16)"
        subtitle="Địa điểm, thu nhập và thời gian nhận việc"
      />

      <div>
        <NumberedFieldLabel
          title="14. Địa điểm mong muốn làm việc"
          description="Anh/chị có thể làm việc ở đâu?"
        />
        <MultiCheck
          options={DESIRED_LOCATION_OPTIONS}
          selected={draft.desiredLocations}
          onChange={(v) => onChange('desiredLocations', v)}
          columns={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">
            15. Thu nhập tối thiểu có thể nhận (VND)
          </span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.expectedSalaryMin != null ? String(draft.expectedSalaryMin) : ''}
              onChange={(digits) =>
                onChange('expectedSalaryMin', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">
            15. Thu nhập kỳ vọng/tháng (VND)
          </span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.expectedOte != null ? String(draft.expectedOte) : ''}
              onChange={(digits) =>
                onChange('expectedOte', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
      </div>
      <p className="-mt-3 text-[11px] text-slate-400">{EXPECTED_INCOME_QUESTION}</p>

      <SelectField
        label="16. Thời gian có thể nhận việc"
        description={AVAILABILITY_QUESTION}
        value={draft.availabilityBand ?? ''}
        onChange={(v) => onChange('availabilityBand', v || null)}
        options={Object.values(AvailabilityBand).map((v) => ({
          value: v,
          label: AVAILABILITY_BAND_LABEL[v],
        }))}
      />

      <SectionTitle
        title="C. Định hướng & phù hợp (17–19)"
        subtitle="Định hướng nghề nghiệp, phong cách làm việc và động lực"
      />

      <div>
        <NumberedFieldLabel
          title="17. Định hướng nghề nghiệp"
          description={CAREER_ORIENTATION_QUESTION}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {CAREER_ORIENTATIONS.map((opt) => {
            const checked = orientation === opt;
            return (
              <label
                key={opt}
                className={clsx(
                  'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                  checked
                    ? 'border-brand-300 bg-brand-50 text-brand-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  name="cv-careerOrientation"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={checked}
                  onChange={() => onChange('careerOrientations', [opt])}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <NumberedFieldLabel
          title={`18. ${CULTURE_FIT_SECTION_TITLE}`}
          description={CULTURE_FIT_SUBTITLE}
        />
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          {CULTURE_FIT_QUESTIONS.map((q, qi) => (
            <div key={q.id}>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                {qi + 1}. {q.question}
              </p>
              <div className="grid gap-2">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const checked = cultureFit[q.id] === opt;
                  return (
                    <label
                      key={opt}
                      className={clsx(
                        'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                        checked
                          ? 'border-brand-300 bg-brand-50 text-brand-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        name={`cv-culture-${q.id}`}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={checked}
                        onChange={() => patchCultureFit(q.id, opt)}
                      />
                      <span>
                        <span className="font-semibold">{letter}. </span>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <NumberedFieldLabel
          title="19. Động lực khi lựa chọn công việc mới"
          description={CAREER_MOTIVATION_QUESTION}
          extra={
            hint('careerMotivations')?.status === 'missing' ? (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
                Thiếu
              </span>
            ) : null
          }
        />
        <p className="mb-2 text-[11px] text-amber-700">
          {`Tối đa 3 (${selectedMotivations.length}/3)`}
        </p>
        <MultiCheck
          options={CAREER_MOTIVATIONS}
          selected={selectedMotivations}
          onChange={(v) =>
            onChange('careerMotivations', filterCareerMotivations(v, 'sales'))
          }
          max={3}
          columns={2}
        />
      </div>

    </div>
  );
}
