'use client';

import clsx from 'clsx';
import {
  AVAILABILITY_BAND_LABEL,
  AvailabilityBand,
  B2B_EXPERIENCE_BAND_LABEL,
  B2bExperienceBand,
  CAREER_MOTIVATIONS,
  CAREER_MOTIVATION_QUESTION,
  CAREER_ORIENTATIONS,
  CAREER_ORIENTATION_QUESTION,
  CULTURE_FIT_QUESTIONS,
  CULTURE_FIT_SECTION_TITLE,
  CULTURE_FIT_SUBTITLE,
  DEAL_TYPE_LABEL,
  DealType,
  DESIRED_POSITIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  JOB_READINESS_LABEL,
  JobReadiness,
  LANGUAGE_OPTIONS,
  SALES_BEHAVIOR_OPTIONS,
  SALES_BEHAVIOR_QUESTION,
  SALES_INDUSTRY_OPTIONS,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  cultureFitAnswersToWorkStyles,
  workStylesToCultureFitAnswers,
  type CultureFitQuestionId,
  type CvDraftFieldHint,
} from '@industriallink/contracts';
import { MoneyInput } from '@/components/ui';
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
              className="mt-0.5"
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
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
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
  value,
  onChange,
  options,
  emptyLabel = '— Chọn —',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
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

  return (
    <div className="space-y-5">
      <SectionTitle
        title="A. Năng lực Sales B2B"
        subtitle="Ngành, band kinh nghiệm, deal và thành tích tổng hợp"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Ngành công nghiệp đã làm</p>
        <MultiCheck
          options={SALES_INDUSTRY_OPTIONS}
          selected={draft.industriesExperienced}
          onChange={(v) => onChange('industriesExperienced', v)}
          columns={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Kinh nghiệm Sales B2B"
          value={draft.b2bExperienceBand ?? ''}
          onChange={(v) => onChange('b2bExperienceBand', v || null)}
          options={Object.values(B2bExperienceBand).map((v) => ({
            value: v,
            label: B2B_EXPERIENCE_BAND_LABEL[v],
          }))}
        />
        <SelectField
          label="Loại thương vụ"
          value={draft.dealType ?? ''}
          onChange={(v) => onChange('dealType', v || null)}
          options={Object.values(DealType).map((v) => ({
            value: v,
            label: DEAL_TYPE_LABEL[v],
          }))}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Tỷ lệ KH tự phát triển (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={draft.newCustomerRatioPct ?? ''}
            onChange={(e) =>
              onChange(
                'newCustomerRatioPct',
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
            placeholder={hint('newCustomerRatio')?.suggestion}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Giá trị deal điển hình (VND)</span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.typicalDealValue != null ? String(draft.typicalDealValue) : ''}
              onChange={(digits) =>
                onChange('typicalDealValue', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Deal lớn nhất (VND)</span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.maxDealValue != null ? String(draft.maxDealValue) : ''}
              onChange={(digits) =>
                onChange('maxDealValue', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
      </div>

      <SectionTitle
        title="B. Điều kiện công việc"
        subtitle="Sẵn sàng, thu nhập, công tác, bằng lái, địa điểm mong muốn"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Mức độ tìm việc"
          value={draft.jobReadiness ?? ''}
          onChange={(v) => onChange('jobReadiness', v || null)}
          options={Object.values(JobReadiness).map((v) => ({
            value: v,
            label: JOB_READINESS_LABEL[v],
          }))}
        />
        <SelectField
          label="Thời gian nhận việc"
          value={draft.availabilityBand ?? ''}
          onChange={(v) => onChange('availabilityBand', v || null)}
          options={Object.values(AvailabilityBand).map((v) => ({
            value: v,
            label: AVAILABILITY_BAND_LABEL[v],
          }))}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Lương tối thiểu (VND)</span>
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
          <span className="text-xs font-semibold text-slate-600">OTE kỳ vọng (VND)</span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.expectedOte != null ? String(draft.expectedOte) : ''}
              onChange={(digits) =>
                onChange('expectedOte', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
        <SelectField
          label="Khả năng đi công tác"
          value={draft.travelAbility ?? ''}
          onChange={(v) => onChange('travelAbility', v || null)}
          options={Object.values(TravelAbility).map((v) => ({
            value: v,
            label: TRAVEL_ABILITY_LABEL[v],
          }))}
        />
        <SelectField
          label="Bằng lái ô tô"
          value={
            draft.hasB2License == null ? '' : draft.hasB2License ? 'true' : 'false'
          }
          onChange={(v) =>
            onChange('hasB2License', v === '' ? null : v === 'true')
          }
          options={[
            { value: 'true', label: 'Có' },
            { value: 'false', label: 'Không' },
          ]}
        />
        <SelectField
          label="Hạng bằng lái"
          value={draft.driverLicenseType ?? ''}
          onChange={(v) => onChange('driverLicenseType', v || null)}
          options={DRIVER_LICENSE_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <SelectField
          label="Trình độ học vấn"
          value={draft.educationLevel ?? ''}
          onChange={(v) => onChange('educationLevel', v || null)}
          options={EDUCATION_LEVELS.map((t) => ({ value: t, label: t }))}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Năm sinh</span>
          <input
            type="number"
            min={1950}
            max={2010}
            value={draft.birthYear ?? ''}
            onChange={(e) =>
              onChange('birthYear', e.target.value === '' ? null : Number(e.target.value))
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Ngoại ngữ</p>
        <MultiCheck
          options={LANGUAGE_OPTIONS}
          selected={draft.languages}
          onChange={(v) => onChange('languages', v)}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Vị trí mong muốn (tối đa 3)</p>
        <MultiCheck
          options={DESIRED_POSITIONS}
          selected={draft.desiredPositions}
          onChange={(v) => onChange('desiredPositions', v.slice(0, 3))}
          max={3}
          columns={2}
        />
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">
          Địa điểm mong muốn (phẩy)
        </span>
        <input
          value={draft.desiredLocations.join(', ')}
          onChange={(e) =>
            onChange(
              'desiredLocations',
              e.target.value
                .split(/[,;\n]/)
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
          placeholder="VD: Hà Nội, TP.HCM"
        />
      </label>

      <SectionTitle
        title="C. Đánh giá nâng cao"
        subtitle="Phong cách Sales, động lực, định hướng và phù hợp văn hóa"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          Phong cách & hành vi Sales — {SALES_BEHAVIOR_QUESTION}
        </p>
        <div className="grid gap-2">
          {SALES_BEHAVIOR_OPTIONS.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const checked = draft.salesBehavior === opt;
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
                  name="cv-salesBehavior"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => onChange('salesBehavior', opt)}
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

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">
          Động lực nghề nghiệp — {CAREER_MOTIVATION_QUESTION}
        </p>
        <p className="mb-2 text-[11px] text-amber-700">
          {draft.careerMotivations.length
            ? `Đã chọn ${draft.careerMotivations.length}/3`
            : 'Chọn đúng 3 yếu tố'}
        </p>
        <MultiCheck
          options={CAREER_MOTIVATIONS}
          selected={draft.careerMotivations}
          onChange={(v) => onChange('careerMotivations', v.slice(0, 3))}
          max={3}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          Định hướng nghề nghiệp — {CAREER_ORIENTATION_QUESTION}
        </p>
        <MultiCheck
          options={CAREER_ORIENTATIONS}
          selected={draft.careerOrientations}
          onChange={(v) => onChange('careerOrientations', v)}
          columns={2}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{CULTURE_FIT_SECTION_TITLE}</p>
          <p className="mt-0.5 text-xs text-slate-500">{CULTURE_FIT_SUBTITLE}</p>
        </div>
        {CULTURE_FIT_QUESTIONS.map((q) => (
          <div key={q.id}>
            <p className="mb-2 text-xs font-semibold text-slate-600">{q.question}</p>
            <div className="grid gap-2">
              {q.options.map((opt, i) => {
                const useLetter = q.options.length <= 2;
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
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => patchCultureFit(q.id, opt)}
                    />
                    <span>
                      {useLetter ? <span className="font-semibold">{letter}. </span> : null}
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
  );
}
