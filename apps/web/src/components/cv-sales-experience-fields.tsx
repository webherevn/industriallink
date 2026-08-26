'use client';

import clsx from 'clsx';
import {
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  DEAL_VALUE_BANDS,
  KPI_ACHIEVEMENT_BANDS,
  MARKET_REGIONS,
  NEW_CUSTOMER_RATIO_BANDS,
  PERSONAL_REVENUE_QUESTION,
  PRODUCTS_SOLD,
  PRODUCTS_SOLD_QUESTION,
  SALES_HIGHLIGHTS_PLACEHOLDER,
  SALES_INDUSTRY_OPTIONS,
  SELLING_STAGES,
  SELLING_STAGES_QUESTION,
  joinDealTypes,
  splitDealTypes,
  type CvDraftFieldHint,
} from '@industriallink/contracts';
import { BrandTechnologySearch } from '@/components/brand-technology-search';
import { NumberedFieldLabel } from '@/components/numbered-field-label';
import { MoneyInput, MonthYearRangeFields } from '@/components/ui';
import { emptyCvExperience, type CvDraft } from '@/lib/cv-templates';

function suggestProducts(query: string) {
  const q = query.trim().toLowerCase();
  const pool = PRODUCTS_SOLD.filter((p) => p !== 'Thiết bị công nghiệp khác');
  const matched = !q ? pool : pool.filter((p) => p.toLowerCase().includes(q));
  return matched.map((name) => ({
    name,
    source: 'catalog' as const,
  }));
}

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
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
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
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              onChange={() => {
                if (checked) onChange(selected.filter((s) => s !== opt));
                else onChange([...selected, opt]);
              }}
            />
            <span>{opt}</span>
          </label>
        );
      })}
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
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
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

function FieldLabel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return <NumberedFieldLabel title={title} description={description} />;
}

/** % KPI đã lưu → band 18.8 để hiển thị lại trong select. */
function pctToKpiBand(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '';
  if (pct < 70) return 'under_70';
  if (pct <= 100) return '70_100';
  return 'over_100';
}

/** % KH tự tìm → band 18.8. */
function pctToNewCustomerBand(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '';
  if (pct < 50) return 'under_50';
  if (pct <= 80) return '50_80';
  return 'over_80';
}

/** VND → band giá trị hợp đồng 18.8. */
function vndToDealValueBand(vnd: number | null | undefined): string {
  if (vnd == null || !Number.isFinite(vnd)) return '';
  if (vnd < 50_000_000) return 'under_50m';
  if (vnd < 200_000_000) return '50_200m';
  if (vnd < 500_000_000) return '200_500m';
  if (vnd < 2_000_000_000) return '0_5_2b';
  if (vnd < 10_000_000_000) return '2_10b';
  return '10b_plus';
}

/**
 * D. Kinh nghiệm công ty (20–34) theo ma trận 18.8 — mỗi công ty một khối,
 * công ty thứ 2 trở đi lặp lại 20–34 (mục E của PDF).
 */
export function CvSalesExperienceFields({
  draft,
  onChange,
  hint,
}: {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
  hint?: CvDraftFieldHint;
}) {
  const dealTypeOptions = DEAL_TYPE_OPTIONS.map((v) => ({
    value: v as string,
    label: DEAL_TYPE_LABEL[v],
  }));

  const experiences = draft.experience.length ? draft.experience : [emptyCvExperience()];

  function updateExperience(
    index: number,
    patch: Partial<CvDraft['experience'][number]>,
  ) {
    onChange(
      'experience',
      experiences.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-t border-slate-100 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-accent-600">
          D. Kinh nghiệm công ty (20–34)
          {hint?.status === 'missing' && (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-600">
              Thiếu
            </span>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Mỗi công ty một khối — công ty thứ 2 trở đi lặp lại các mục 20–34.
        </p>
      </div>

      {experiences.map((exp, index) => {
        const dealTypesSelected = splitDealTypes(exp.dealType).map(
          (v) => DEAL_TYPE_LABEL[v],
        );
        const allStagesSelected = exp.sellingStages.length === SELLING_STAGES.length;
        return (
          <div
            key={`exp-${index}`}
            className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">
                Kinh nghiệm công ty {index + 1}
              </p>
              {draft.experience.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      'experience',
                      draft.experience.filter((_, i) => i !== index),
                    )
                  }
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Xoá
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  20. Tên công ty
                </span>
                <input
                  value={exp.company}
                  onChange={(e) => updateExperience(index, { company: e.target.value })}
                  placeholder="Anh/chị từng làm việc tại công ty nào?"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">21. Vị trí</span>
                <input
                  value={exp.role}
                  onChange={(e) => updateExperience(index, { role: e.target.value })}
                  placeholder="Anh/chị làm vị trí gì tại công ty này?"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                />
              </label>
            </div>

            {(() => {
              const parts = periodParts(exp.period);
              return (
                <div>
                  <NumberedFieldLabel title="22. Thời gian làm việc" />
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
              );
            })()}

            <div>
              <FieldLabel
                title="23. Ngành / lĩnh vực"
                description="Anh/chị làm trong lĩnh vực nào tại công ty này?"
              />
              <MultiCheck
                options={INDUSTRY_OPTIONS}
                selected={exp.industries}
                onChange={(v) => updateExperience(index, { industries: v })}
                columns={2}
              />
            </div>

            <div>
              <FieldLabel
                title="24. Sản phẩm / thiết bị đã bán"
                description={PRODUCTS_SOLD_QUESTION}
              />
              <BrandTechnologySearch
                selected={exp.productsSold}
                onChange={(v) => updateExperience(index, { productsSold: v })}
                suggest={suggestProducts}
                placeholder="Tìm thiết bị công nghiệp (máy nén khí, PLC, HVAC…)"
                hint="Gõ để gợi ý sản phẩm/thiết bị. Không có trong danh sách — bấm “+ Thêm” để nhập tay."
                emptyMessage="Gõ tên thiết bị để tìm trong danh mục"
              />
            </div>

            <div>
              <FieldLabel title="25. Nhóm khách hàng đã bán" />
              <MultiCheck
                options={CUSTOMER_SEGMENTS}
                selected={exp.customerSegments}
                onChange={(v) => updateExperience(index, { customerSegments: v })}
                columns={2}
              />
            </div>

            <div>
              <FieldLabel title="26. Giải pháp sản phẩm" />
              <MultiCheck
                options={dealTypeOptions.map((o) => o.label)}
                selected={dealTypesSelected}
                onChange={(labels) => {
                  const values = labels
                    .map((l) => dealTypeOptions.find((o) => o.label === l)?.value)
                    .filter((v): v is string => Boolean(v));
                  updateExperience(index, { dealType: joinDealTypes(values) });
                }}
                columns={2}
              />
            </div>

            <div>
              <FieldLabel
                title="27. Phạm vi công việc bán hàng đã phụ trách"
                description={SELLING_STAGES_QUESTION}
              />
              <button
                type="button"
                onClick={() =>
                  updateExperience(index, {
                    sellingStages: allStagesSelected ? [] : [...SELLING_STAGES],
                  })
                }
                className="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
              >
                {allStagesSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
              <MultiCheck
                options={SELLING_STAGES}
                selected={exp.sellingStages}
                onChange={(v) => updateExperience(index, { sellingStages: v })}
                columns={2}
              />
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-slate-800">
                  Mô tả/phạm vi công việc thực tế
                </span>
                <p className="mt-0.5 text-xs text-slate-500">
                  Viết thêm nếu checkbox chưa đủ mô tả công việc anh/chị đã phụ trách.
                </p>
                <textarea
                  rows={3}
                  value={exp.jobDescription ?? ''}
                  onChange={(e) =>
                    updateExperience(index, { jobDescription: e.target.value })
                  }
                  placeholder="VD: Phụ trách bán thiết bị khí nén khu vực miền Nam, từ tìm khách đến chốt đơn và bàn giao kỹ thuật."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-brand-500/30 focus:ring-2"
                />
              </label>
            </div>

            <details className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                28–34. Nhóm khuyến khích — giúp AI kết nối với NTD dễ hơn
              </summary>
              <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                <div>
                  <FieldLabel
                    title="28. Hãng / thương hiệu sản phẩm"
                    description="Anh/chị từng làm sản phẩm/thiết bị hãng nào?"
                  />
                  <BrandTechnologySearch
                    selected={exp.brandsTechnologies ?? []}
                    onChange={(next) =>
                      updateExperience(index, { brandsTechnologies: next })
                    }
                  />
                </div>
                <div>
                  <FieldLabel title="29. Khu vực / thị trường phụ trách" />
                  <MultiCheck
                    options={MARKET_REGIONS}
                    selected={exp.marketsCovered}
                    onChange={(v) => updateExperience(index, { marketsCovered: v })}
                    columns={3}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      30. {PERSONAL_REVENUE_QUESTION}
                    </span>
                    <div className="mt-1.5">
                      <MoneyInput
                        value={exp.latestRevenue != null ? String(exp.latestRevenue) : ''}
                        onChange={(digits) =>
                          updateExperience(index, {
                            latestRevenue: digits ? Number(digits) : null,
                          })
                        }
                        placeholder="Ví dụ: 12 tỷ/năm"
                      />
                    </div>
                  </label>
                  <SelectField
                    label="31. Mức độ hoàn thành KPI"
                    value={pctToKpiBand(exp.kpiAchievementPct)}
                    onChange={(v) => {
                      const band = KPI_ACHIEVEMENT_BANDS.find((b) => b.value === v);
                      updateExperience(index, {
                        kpiAchievementPct: band ? band.midPct : null,
                      });
                    }}
                    options={KPI_ACHIEVEMENT_BANDS.map((b) => ({
                      value: b.value,
                      label: b.label,
                    }))}
                  />
                  <SelectField
                    label="32. Tỷ lệ khách hàng tự tìm kiếm"
                    value={pctToNewCustomerBand(exp.newCustomerRatioPct)}
                    onChange={(v) => {
                      const band = NEW_CUSTOMER_RATIO_BANDS.find((b) => b.value === v);
                      updateExperience(index, {
                        newCustomerRatioPct: band ? band.midPct : null,
                      });
                    }}
                    options={NEW_CUSTOMER_RATIO_BANDS.map((b) => ({
                      value: b.value,
                      label: b.label,
                    }))}
                  />
                  <SelectField
                    label="33. Giá trị hợp đồng thường gặp"
                    value={vndToDealValueBand(exp.typicalDealValue)}
                    onChange={(v) => {
                      const band = DEAL_VALUE_BANDS.find((b) => b.value === v);
                      updateExperience(index, {
                        typicalDealValue: band ? band.midVnd : null,
                      });
                    }}
                    options={DEAL_VALUE_BANDS.map((b) => ({
                      value: b.value,
                      label: b.label,
                    }))}
                  />
                </div>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">
                    34. Thành tích kinh doanh nổi bật tại công ty này?
                  </span>
                  <textarea
                    rows={3}
                    value={exp.bullets}
                    onChange={(e) => updateExperience(index, { bullets: e.target.value })}
                    placeholder={SALES_HIGHLIGHTS_PLACEHOLDER}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-brand-500/30 focus:ring-2"
                  />
                </label>
              </div>
            </details>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange('experience', [...draft.experience, emptyCvExperience()])}
        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        + Thêm công ty (lặp lại mục 20–34)
      </button>
    </div>
  );
}
