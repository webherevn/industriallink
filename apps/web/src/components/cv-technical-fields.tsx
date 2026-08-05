'use client';

import clsx from 'clsx';
import {
  AVAILABILITY_BAND_LABEL,
  AvailabilityBand,
  BRANDS_TECHNOLOGIES,
  CAREER_MOTIVATIONS,
  CAREER_MOTIVATION_QUESTION,
  CUSTOMER_SEGMENTS,
  DOCUMENT_LITERACY_OPTIONS,
  DRIVER_LICENSE_TYPES,
  EQUIPMENT_SYSTEM_OPTIONS,
  JOB_READINESS_LABEL,
  JobReadiness,
  LANGUAGE_OPTIONS,
  SALES_INDUSTRY_OPTIONS,
  SHIFT_FLEXIBILITY_OPTIONS,
  TECHNICAL_AUTONOMY_LEVELS,
  TECHNICAL_CAREER_MOTIVATIONS,
  TECHNICAL_CAREER_ORIENTATIONS,
  TECHNICAL_HIGHLIGHTS_HINT,
  TECHNICAL_HIGHLIGHTS_PLACEHOLDER,
  TECHNICAL_HIGHLIGHTS_QUESTION,
  TECHNICAL_TOOLS,
  TECHNICAL_WORK_TYPES,
  TRACK_FIELD_LABELS,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  TROUBLESHOOTING_LEVELS,
  JobTrack,
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-t border-slate-100 pt-5">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
      >
        <option value="">— Chọn —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LevelScale({
  label,
  value,
  onChange,
  levels,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  levels: readonly { value: number; label: string }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-600">{label}</p>
      <div className="space-y-1.5">
        {levels.map((lv) => (
          <label
            key={lv.value}
            className={clsx(
              'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm',
              value === lv.value
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white text-slate-700',
            )}
          >
            <input
              type="radio"
              className="mt-0.5"
              checked={value === lv.value}
              onChange={() => onChange(lv.value)}
            />
            <span>
              <span className="font-semibold">{lv.value}.</span> {lv.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const MOTIVATION_OPTIONS = [
  ...new Set([...CAREER_MOTIVATIONS, ...TECHNICAL_CAREER_MOTIVATIONS]),
];
const ORIENTATION_OPTIONS = [...TECHNICAL_CAREER_ORIENTATIONS];

/** Form tiêu chí kỹ thuật — tái sử dụng field chung + field KT thuần. */
export function CvTechnicalFields({
  draft,
  onChange,
}: {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="A. Năng lực kỹ thuật"
        subtitle="Thiết bị, hãng, nghiệp vụ — dữ liệu dùng chung với hồ sơ Sales khi trùng nghĩa"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Ngành / lĩnh vực đã làm</p>
        <MultiCheck
          options={SALES_INDUSTRY_OPTIONS}
          selected={draft.industriesExperienced}
          onChange={(v) => onChange('industriesExperienced', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          {TRACK_FIELD_LABELS.productsSold[JobTrack.Technical]}
        </p>
        <MultiCheck
          options={EQUIPMENT_SYSTEM_OPTIONS}
          selected={draft.productsSold}
          onChange={(v) => onChange('productsSold', v)}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Hãng / công nghệ</p>
        <MultiCheck
          options={BRANDS_TECHNOLOGIES}
          selected={draft.brandsTechnologies}
          onChange={(v) => onChange('brandsTechnologies', v)}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Loại công việc / nghiệp vụ kỹ thuật</p>
        <MultiCheck
          options={TECHNICAL_WORK_TYPES}
          selected={draft.technicalWorkTypes}
          onChange={(v) => onChange('technicalWorkTypes', v)}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          {TRACK_FIELD_LABELS.customerSegments[JobTrack.Technical]}
        </p>
        <MultiCheck
          options={CUSTOMER_SEGMENTS}
          selected={draft.customerSegments}
          onChange={(v) => onChange('customerSegments', v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LevelScale
          label="Mức độ tự chủ"
          value={draft.technicalAutonomyLevel}
          onChange={(v) => onChange('technicalAutonomyLevel', v)}
          levels={TECHNICAL_AUTONOMY_LEVELS}
        />
        <LevelScale
          label="Xử lý sự cố / troubleshooting"
          value={draft.troubleshootingLevel}
          onChange={(v) => onChange('troubleshootingLevel', v)}
          levels={TROUBLESHOOTING_LEVELS}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Phần mềm / công cụ</p>
        <MultiCheck
          options={TECHNICAL_TOOLS}
          selected={draft.technicalTools}
          onChange={(v) => onChange('technicalTools', v)}
          columns={2}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Đọc bản vẽ / tài liệu</p>
        <MultiCheck
          options={DOCUMENT_LITERACY_OPTIONS}
          selected={draft.documentLiteracy}
          onChange={(v) => onChange('documentLiteracy', v)}
          columns={2}
        />
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">
          Quy mô / công suất hệ thống lớn nhất
        </span>
        <textarea
          rows={2}
          value={draft.systemScaleNote ?? ''}
          onChange={(e) => onChange('systemScaleNote', e.target.value || null)}
          placeholder="VD: Máy nén khí 250 kW / 8 bar; Chiller 500 RT; PLC 2000 I/O…"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">
          {TRACK_FIELD_LABELS.salesHighlights[JobTrack.Technical]}
        </span>
        <p className="mt-0.5 text-[11px] text-slate-500">{TECHNICAL_HIGHLIGHTS_QUESTION}</p>
        <textarea
          rows={4}
          value={draft.salesHighlights}
          onChange={(e) => onChange('salesHighlights', e.target.value)}
          placeholder={TECHNICAL_HIGHLIGHTS_PLACEHOLDER}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          {TECHNICAL_HIGHLIGHTS_HINT}
        </p>
      </label>

      <SectionTitle title="B. Điều kiện công việc" subtitle="Lương, nhận việc, công tác" />

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
          placeholder="VD: Hà Nội, TP.HCM, Đà Nẵng"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Mức độ sẵn sàng chuyển việc"
          value={draft.jobReadiness ?? ''}
          onChange={(v) => onChange('jobReadiness', v || null)}
          options={Object.values(JobReadiness).map((v) => ({
            value: v,
            label: JOB_READINESS_LABEL[v],
          }))}
        />
        <SelectField
          label="Thời gian có thể nhận việc"
          value={draft.availabilityBand ?? ''}
          onChange={(v) => onChange('availabilityBand', v || null)}
          options={Object.values(AvailabilityBand).map((v) => ({
            value: v,
            label: AVAILABILITY_BAND_LABEL[v],
          }))}
        />
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
          label="Làm ca / xử lý ngoài giờ"
          value={draft.shiftFlexibility ?? ''}
          onChange={(v) => onChange('shiftFlexibility', v || null)}
          options={SHIFT_FLEXIBILITY_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Lương kỳ vọng min (VND)</span>
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
          <span className="text-xs font-semibold text-slate-600">Lương kỳ vọng max (VND)</span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.expectedSalaryMax != null ? String(draft.expectedSalaryMax) : ''}
              onChange={(digits) =>
                onChange('expectedSalaryMax', digits ? Number(digits) : null)
              }
            />
          </div>
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">Ngoại ngữ</p>
        <MultiCheck
          options={LANGUAGE_OPTIONS}
          selected={draft.languages}
          onChange={(v) => onChange('languages', v)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Bằng lái ô tô"
          value={
            draft.hasB2License === true
              ? draft.driverLicenseType || 'B2'
              : draft.hasB2License === false
                ? 'none'
                : ''
          }
          onChange={(v) => {
            if (v === 'none') {
              onChange('hasB2License', false);
              onChange('driverLicenseType', null);
            } else if (v) {
              onChange('hasB2License', true);
              onChange('driverLicenseType', v);
            } else {
              onChange('hasB2License', null);
              onChange('driverLicenseType', null);
            }
          }}
          options={[
            { value: 'none', label: 'Không' },
            ...DRIVER_LICENSE_TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>

      <SectionTitle title="C. Định hướng nghề nghiệp" subtitle="Tuỳ chọn — matching nâng cao" />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          {CAREER_MOTIVATION_QUESTION} (tối đa 3)
        </p>
        <MultiCheck
          options={MOTIVATION_OPTIONS}
          selected={draft.careerMotivations}
          onChange={(v) => onChange('careerMotivations', v)}
          max={3}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          Định hướng nghề nghiệp 2–3 năm tới
        </p>
        <MultiCheck
          options={ORIENTATION_OPTIONS}
          selected={draft.careerOrientations}
          onChange={(v) => onChange('careerOrientations', v)}
          max={3}
        />
      </div>
    </div>
  );
}
