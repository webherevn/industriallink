'use client';

import clsx from 'clsx';
import { useState } from 'react';
import {
  AVAILABILITY_BAND_LABEL,
  AVAILABILITY_QUESTION,
  AvailabilityBand,
  DESIRED_LOCATION_OPTIONS,
  EXPECTED_INCOME_QUESTION,
  DOCUMENT_LITERACY_OPTIONS,
  DOCUMENT_LITERACY_QUESTION,
  SHIFT_FLEXIBILITY_OPTIONS,
  SHIFT_FLEXIBILITY_QUESTION,
  TECHNICAL_CAREER_MOTIVATIONS,
  TECHNICAL_CAREER_ORIENTATIONS,
  TECHNICAL_MOTIVATION_QUESTION,
  TECHNICAL_ORIENTATION_QUESTION,
  TECHNICAL_TOOLS,
  TECHNICAL_TOOLS_QUESTION,
  TECHNICAL_WORK_STYLES,
  TECHNICAL_WORK_STYLE_QUESTION,
  WORK_ENVIRONMENT_DESIRED_QUESTION,
  WORK_ENVIRONMENT_OPTIONS,
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

/** MultiCheck + ô nhập "Khác: ___" theo PDF. */
function MultiCheckWithCustom({
  options,
  selected,
  onChange,
  placeholder,
  columns = 2,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  columns?: 1 | 2 | 3;
}) {
  const [text, setText] = useState('');
  const customValues = selected.filter((s) => !options.includes(s));

  function addCustom() {
    const value = text.trim();
    if (!value || selected.includes(value)) return;
    onChange([...selected, value]);
    setText('');
  }

  return (
    <div className="space-y-2">
      <MultiCheck options={options} selected={selected} onChange={onChange} columns={columns} />
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-t border-slate-100 pt-5">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function RadioList({
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  columns?: 1 | 2;
}) {
  return (
    <div className={clsx('grid gap-2', columns === 2 && 'sm:grid-cols-2')}>
      {options.map((opt) => {
        const checked = value === opt;
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
              name={name}
              className="mt-0.5"
              checked={checked}
              onChange={() => onChange(opt)}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Khối B/C theo ma trận Kỹ thuật 31 mục (update 18.8) — hiện khi chọn hướng Kỹ thuật.
 * B. Mong muốn nghề nghiệp (14–16; STT 13 nằm ở khối vị trí ứng tuyển phía trên)
 * C. Năng lực và định hướng (17–23)
 * D. Kinh nghiệm công ty (24–31) nằm ở khối CvTechnicalExperienceFields phía sau.
 */
export function CvTechnicalFields({
  draft,
  onChange,
}: {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
}) {
  const orientation = draft.careerOrientations[0] ?? '';

  return (
    <div className="space-y-5">
      <SectionTitle
        title="B. Mong muốn nghề nghiệp (14–16)"
        subtitle="Địa điểm, thu nhập và thời gian nhận việc"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          14. Địa điểm mong muốn làm việc — Anh/chị có thể làm việc ở đâu?
        </p>
        <MultiCheck
          options={DESIRED_LOCATION_OPTIONS}
          selected={draft.desiredLocations}
          onChange={(v) => onChange('desiredLocations', v)}
          columns={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">
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
          <span className="text-xs font-semibold text-slate-600">
            15. Thu nhập kỳ vọng/tháng (VND)
          </span>
          <div className="mt-1.5">
            <MoneyInput
              value={draft.expectedOte != null ? String(draft.expectedOte) : ''}
              onChange={(digits) => onChange('expectedOte', digits ? Number(digits) : null)}
            />
          </div>
        </label>
      </div>
      <p className="-mt-3 text-[11px] text-slate-400">{EXPECTED_INCOME_QUESTION}</p>

      <label className="block">
        <span className="text-xs font-semibold text-slate-600">
          16. Thời gian có thể nhận việc — {AVAILABILITY_QUESTION}
        </span>
        <select
          value={draft.availabilityBand ?? ''}
          onChange={(e) => onChange('availabilityBand', e.target.value || null)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        >
          <option value="">— Chọn —</option>
          {Object.values(AvailabilityBand).map((v) => (
            <option key={v} value={v}>
              {AVAILABILITY_BAND_LABEL[v]}
            </option>
          ))}
        </select>
      </label>

      <SectionTitle
        title="C. Năng lực và định hướng (17–23)"
        subtitle="Ngoài giờ, phần mềm, tài liệu, cách làm việc, định hướng, động lực, môi trường"
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          17. Khả năng làm ngoài giờ — {SHIFT_FLEXIBILITY_QUESTION}
        </p>
        <RadioList
          name="cv-shiftFlexibility"
          options={SHIFT_FLEXIBILITY_OPTIONS.map((o) => o.label)}
          value={
            SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.value === draft.shiftFlexibility)?.label ??
            ''
          }
          onChange={(label) => {
            const opt = SHIFT_FLEXIBILITY_OPTIONS.find((o) => o.label === label);
            onChange('shiftFlexibility', opt ? opt.value : null);
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          18. Phần mềm &amp; công cụ đã sử dụng — {TECHNICAL_TOOLS_QUESTION}
        </p>
        <MultiCheckWithCustom
          options={TECHNICAL_TOOLS}
          selected={draft.technicalTools}
          onChange={(v) => onChange('technicalTools', v)}
          placeholder="VD: EPLAN, TIA Portal…"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          19. Đọc bản vẽ / tài liệu — {DOCUMENT_LITERACY_QUESTION}
        </p>
        <MultiCheckWithCustom
          options={DOCUMENT_LITERACY_OPTIONS}
          selected={draft.documentLiteracy}
          onChange={(v) => onChange('documentLiteracy', v)}
          placeholder="VD: Sơ đồ thủy lực…"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          20. Cách làm việc kỹ thuật — {TECHNICAL_WORK_STYLE_QUESTION}
        </p>
        <MultiCheck
          options={TECHNICAL_WORK_STYLES}
          selected={draft.workStyles}
          onChange={(v) => onChange('workStyles', v.slice(0, 3))}
          max={3}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          21. Định hướng nghề nghiệp — {TECHNICAL_ORIENTATION_QUESTION}
        </p>
        <RadioList
          name="cv-technicalOrientation"
          options={TECHNICAL_CAREER_ORIENTATIONS}
          value={
            (TECHNICAL_CAREER_ORIENTATIONS as readonly string[]).includes(orientation)
              ? orientation
              : orientation.startsWith('Khác')
                ? 'Khác'
                : ''
          }
          onChange={(opt) => {
            if (opt !== 'Khác') {
              onChange('careerOrientations', [opt]);
              return;
            }
            onChange(
              'careerOrientations',
              [orientation.startsWith('Khác') ? orientation : 'Khác'],
            );
          }}
        />
        {(orientation === 'Khác' || orientation.startsWith('Khác:')) && (
          <input
            value={orientation.startsWith('Khác:') ? orientation.slice(5).trimStart() : ''}
            onChange={(e) => {
              const t = e.target.value;
              onChange('careerOrientations', [t.trim() ? `Khác: ${t}` : 'Khác']);
            }}
            placeholder="Khác: nhập hướng phát triển…"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
          />
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">
          22. Động lực khi lựa chọn công việc mới — {TECHNICAL_MOTIVATION_QUESTION}
        </p>
        <p className="mb-2 text-[11px] text-amber-700">
          {draft.careerMotivations.length
            ? `Đã chọn ${draft.careerMotivations.length}/3`
            : 'Chọn đúng 3 yếu tố'}
        </p>
        <MultiCheck
          options={TECHNICAL_CAREER_MOTIVATIONS}
          selected={draft.careerMotivations}
          onChange={(v) => onChange('careerMotivations', v.slice(0, 3))}
          max={3}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-600">
          23. Môi trường làm việc mong muốn — {WORK_ENVIRONMENT_DESIRED_QUESTION}
        </p>
        <MultiCheck
          options={WORK_ENVIRONMENT_OPTIONS}
          selected={draft.desiredWorkEnvironments}
          onChange={(v) => onChange('desiredWorkEnvironments', v.slice(0, 3))}
          max={3}
        />
      </div>
    </div>
  );
}
