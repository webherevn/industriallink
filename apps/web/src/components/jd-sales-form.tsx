'use client';

import clsx from 'clsx';
import {
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  EmploymentType,
  ExperienceBand,
  JD_SALES_GROUPS,
  JD_SALES_INDUSTRY_OPTIONS,
  JD_SALES_TITLE_OPTIONS,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  type JdSalesFieldKey,
} from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { BrandTechnologySearch } from '@/components/brand-technology-search';
import { LocationPicker } from '@/components/location-picker';
import { MatrixSection } from '@/components/matrix-section';
import { NumberedFieldLabel } from '@/components/numbered-field-label';
import { Input, MoneyInput, Select, Textarea } from '@/components/ui';
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL } from '@/lib/format';
import type { JdSalesFormState } from '@/lib/jd-sales-form';
import { formHasJobFit } from '@/lib/jd-sales-form';

function suggestProducts(query: string) {
  const q = query.trim().toLowerCase();
  const pool = PRODUCTS_SOLD.filter((p) => p !== 'Thiết bị công nghiệp khác');
  const matched = !q ? pool : pool.filter((p) => p.toLowerCase().includes(q));
  return matched.map((name) => ({ name, source: 'catalog' as const }));
}

function UncertainBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
      Cần xác nhận
    </span>
  );
}

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
              'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-[12px] leading-tight transition',
              checked
                ? 'border-brand-300 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={checked}
              onChange={() => {
                if (checked) onChange(selected.filter((s) => s !== opt));
                else onChange([...selected, opt]);
              }}
            />
            <span className="min-w-0">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
            value === opt.value
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function JdSalesForm({
  form,
  onChange,
  uncertainKeys = [],
  disabled,
}: {
  form: JdSalesFormState;
  onChange: (patch: Partial<JdSalesFormState>) => void;
  uncertainKeys?: JdSalesFieldKey[];
  disabled?: boolean;
}) {
  const uncertain = new Set(uncertainKeys);
  const openJobFit = formHasJobFit(form);
  const dealLabels = DEAL_TYPE_OPTIONS.map((v) => DEAL_TYPE_LABEL[v]);
  const selectedDealLabels = form.dealTypes.map((v) => DEAL_TYPE_LABEL[v as keyof typeof DEAL_TYPE_LABEL] ?? v);
  const allStages = form.sellingStages.length === SELLING_STAGES.length;

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <MatrixSection title={JD_SALES_GROUPS.A.title} subtitle={JD_SALES_GROUPS.A.subtitle} defaultOpen>
        <div>
          <NumberedFieldLabel
            title="1. Vị trí tuyển dụng"
            extra={<UncertainBadge show={uncertain.has('title')} />}
          />
          <Input
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="VD: Nhân viên kinh doanh thiết bị công nghiệp"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {JD_SALES_TITLE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ title: opt })}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                  form.title === opt
                    ? 'border-brand-400 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <NumberedFieldLabel
            title="2. Ngành / lĩnh vực"
            extra={<UncertainBadge show={uncertain.has('industries')} />}
          />
          <MultiCheck
            options={JD_SALES_INDUSTRY_OPTIONS}
            selected={form.industries}
            onChange={(industries) => onChange({ industries })}
            columns={2}
          />
          <p className="mt-2 text-[11px] text-slate-500">Lọc cứng ngành (mặc định không lọc; khi bật: gần = cùng cụm ≥ 85%)</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(
              [
                ['off', 'Không lọc cứng'],
                ['near', 'Chấp nhận ngành gần (≥ 85%)'],
                ['exact', 'Chỉ đúng ngành (100%)'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ industryHardMode: value })}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                  form.industryHardMode === value
                    ? 'border-brand-400 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <NumberedFieldLabel
            title="3. Hình thức làm việc"
            extra={<UncertainBadge show={uncertain.has('employmentType')} />}
          />
          <PillGroup
            options={Object.values(EmploymentType).map((v) => ({
              value: v,
              label: EMPLOYMENT_LABEL[v],
            }))}
            value={form.employmentType}
            onChange={(employmentType) => onChange({ employmentType })}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="4. Địa điểm làm việc"
            extra={<UncertainBadge show={uncertain.has('location')} />}
          />
          <LocationPicker
            variant="field"
            multiple
            placeholder="Chọn tỉnh / KCN"
            value={parseJoinedLocations(form.location)}
            onChange={(labels) => onChange({ location: joinLocationLabels(labels) })}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="5. Kinh nghiệm yêu cầu"
            extra={<UncertainBadge show={uncertain.has('experienceBand')} />}
          />
          <PillGroup
            options={Object.values(ExperienceBand).map((v) => ({
              value: v,
              label: EXPERIENCE_LABEL[v],
            }))}
            value={form.experienceBand}
            onChange={(experienceBand) => onChange({ experienceBand })}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="6. Mức thu nhập"
            description="Mức tối thiểu công ty chi trả và mức kỳ vọng (nếu JD nêu)."
            extra={<UncertainBadge show={uncertain.has('salary')} />}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyInput
              value={form.salaryMin}
              onChange={(salaryMin) => onChange({ salaryMin })}
              placeholder="Tối thiểu (VND)"
            />
            <MoneyInput
              value={form.salaryMax}
              onChange={(salaryMax) => onChange({ salaryMax })}
              placeholder="Kỳ vọng (VND)"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <NumberedFieldLabel
              title="7. Số lượng tuyển dụng"
              extra={<UncertainBadge show={uncertain.has('headcount')} />}
            />
            <Input
              type="number"
              min={1}
              value={form.headcount}
              onChange={(e) => onChange({ headcount: e.target.value })}
              placeholder="VD: 2"
            />
          </div>
          <div>
            <NumberedFieldLabel
              title="8. Hạn nộp hồ sơ"
              extra={<UncertainBadge show={uncertain.has('deadline')} />}
            />
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => onChange({ deadline: e.target.value })}
            />
          </div>
        </div>
      </MatrixSection>

      <MatrixSection title={JD_SALES_GROUPS.B.title} subtitle={JD_SALES_GROUPS.B.subtitle} defaultOpen>
        <div>
          <NumberedFieldLabel
            title="9. Sản phẩm / thiết bị"
            description="Chỉ chọn mục JD nêu rõ — không suy diễn."
            extra={<UncertainBadge show={uncertain.has('productsSold')} />}
          />
          <BrandTechnologySearch
            selected={form.productsSold}
            onChange={(productsSold) => onChange({ productsSold })}
            suggest={suggestProducts}
            placeholder="Tìm thiết bị (máy nén khí, PLC, HVAC…)"
            hint="Gõ để gợi ý. Không có trong danh sách — bấm “+ Thêm” nếu JD nêu tên cụ thể."
            emptyMessage="Gõ tên thiết bị để tìm trong danh mục"
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="10. Nhóm khách hàng"
            extra={<UncertainBadge show={uncertain.has('customerSegments')} />}
          />
          <MultiCheck
            options={CUSTOMER_SEGMENTS}
            selected={form.customerSegments}
            onChange={(customerSegments) => onChange({ customerSegments })}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="11. Loại hình kinh doanh"
            extra={<UncertainBadge show={uncertain.has('dealTypes')} />}
          />
          <MultiCheck
            options={dealLabels}
            selected={selectedDealLabels}
            onChange={(labels) => {
              const dealTypes = labels
                .map((l) => DEAL_TYPE_OPTIONS.find((v) => DEAL_TYPE_LABEL[v] === l))
                .filter((v): v is (typeof DEAL_TYPE_OPTIONS)[number] => Boolean(v));
              onChange({ dealTypes: [...dealTypes] });
            }}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="12. Phạm vi công việc bán hàng"
            extra={<UncertainBadge show={uncertain.has('sellingStages')} />}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                sellingStages: allStages ? [] : [...SELLING_STAGES],
              })
            }
            className="mb-2 text-xs font-semibold text-brand-700 hover:underline"
          >
            {allStages ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <MultiCheck
            options={SELLING_STAGES}
            selected={form.sellingStages}
            onChange={(sellingStages) => onChange({ sellingStages })}
            columns={2}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="13. Khu vực / thị trường phụ trách"
            extra={<UncertainBadge show={uncertain.has('marketsCovered')} />}
          />
          <MultiCheck
            options={MARKET_REGIONS}
            selected={form.marketsCovered}
            onChange={(marketsCovered) => onChange({ marketsCovered })}
            columns={3}
          />
        </div>
      </MatrixSection>

      <MatrixSection
        title={JD_SALES_GROUPS.C.title}
        subtitle={JD_SALES_GROUPS.C.subtitle}
        defaultOpen={openJobFit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <NumberedFieldLabel
              title="14. Trình độ học vấn"
              extra={<UncertainBadge show={uncertain.has('educationLevel')} />}
            />
            <Select
              value={form.educationLevel}
              onChange={(e) => onChange({ educationLevel: e.target.value })}
            >
              <option value="">Không yêu cầu / không nêu</option>
              {EDUCATION_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <NumberedFieldLabel
              title="15. Chuyên ngành"
              extra={<UncertainBadge show={uncertain.has('educationMajor')} />}
            />
            <Input
              value={form.educationMajor}
              onChange={(e) => onChange({ educationMajor: e.target.value })}
              placeholder="Chỉ điền khi JD nêu"
            />
          </div>
        </div>

        <div>
          <NumberedFieldLabel
            title="16. Ngoại ngữ"
            extra={<UncertainBadge show={uncertain.has('languages')} />}
          />
          <MultiCheck
            options={LANGUAGE_OPTIONS}
            selected={form.languages}
            onChange={(languages) => onChange({ languages })}
            columns={3}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="17. Giấy phép lái xe"
            extra={<UncertainBadge show={uncertain.has('driverLicenses')} />}
          />
          <MultiCheck
            options={DRIVER_LICENSE_TYPES}
            selected={form.driverLicenses}
            onChange={(next) => {
              if (next.includes('Chưa có') && next[next.length - 1] === 'Chưa có') {
                onChange({ driverLicenses: ['Chưa có'] });
              } else {
                onChange({ driverLicenses: next.filter((x) => x !== 'Chưa có') });
              }
            }}
            columns={2}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="18. Khả năng đi công tác"
            extra={<UncertainBadge show={uncertain.has('travelAbility')} />}
          />
          <PillGroup
            options={Object.values(TravelAbility).map((v) => ({
              value: v,
              label: TRAVEL_ABILITY_LABEL[v],
            }))}
            value={form.travelAbility}
            onChange={(travelAbility) => onChange({ travelAbility })}
          />
        </div>
      </MatrixSection>

      <MatrixSection title={JD_SALES_GROUPS.D.title} subtitle={JD_SALES_GROUPS.D.subtitle} defaultOpen>
        <div>
          <NumberedFieldLabel
            title="19. Mô tả công việc"
            extra={<UncertainBadge show={uncertain.has('description')} />}
          />
          <Textarea
            rows={6}
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Giữ nguyên nội dung JD hoặc biên tập ngắn gọn"
          />
        </div>
        <div>
          <NumberedFieldLabel
            title="20. Yêu cầu công việc"
            extra={<UncertainBadge show={uncertain.has('requirements')} />}
          />
          <Textarea
            rows={5}
            value={form.requirements}
            onChange={(e) => onChange({ requirements: e.target.value })}
          />
        </div>
        <div>
          <NumberedFieldLabel
            title="21. Kỹ năng"
            extra={<UncertainBadge show={uncertain.has('skills')} />}
          />
          <Input
            value={form.skills}
            onChange={(e) => onChange({ skills: e.target.value })}
            placeholder="Cách nhau bởi dấu phẩy"
          />
        </div>
        <div>
          <NumberedFieldLabel
            title="22. Quyền lợi"
            extra={<UncertainBadge show={uncertain.has('benefits')} />}
          />
          <Textarea
            rows={4}
            value={form.benefits}
            onChange={(e) => onChange({ benefits: e.target.value })}
          />
        </div>
      </MatrixSection>
    </fieldset>
  );
}
