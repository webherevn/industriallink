'use client';

import clsx from 'clsx';
import {
  DOCUMENT_LITERACY_OPTIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  EQUIPMENT_SYSTEM_OPTIONS,
  ExperienceBand,
  JD_TECHNICAL_AUTONOMY_OPTIONS,
  JD_TECHNICAL_CERTIFICATE_OPTIONS,
  JD_TECHNICAL_GROUPS,
  JD_TECHNICAL_INDUSTRY_OPTIONS,
  JD_TECHNICAL_SHIFT_OPTIONS,
  JD_TECHNICAL_TITLE_OPTIONS,
  LANGUAGE_OPTIONS,
  TECHNICAL_TOOLS,
  TECHNICAL_WORK_TYPES,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  WORK_ENVIRONMENT_OPTIONS,
  type JdTechnicalFieldKey,
} from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { BrandTechnologySearch } from '@/components/brand-technology-search';
import { LocationPicker } from '@/components/location-picker';
import { MatrixSection } from '@/components/matrix-section';
import { NumberedFieldLabel } from '@/components/numbered-field-label';
import { Input, MoneyInput, Select, Textarea } from '@/components/ui';
import { EXPERIENCE_LABEL } from '@/lib/format';
import {
  formHasTechnicalJobFit,
  type JdTechnicalFormState,
} from '@/lib/jd-technical-form';

function suggestFromCatalog(catalog: readonly string[], extra?: string) {
  return (query: string) => {
    const q = query.trim().toLowerCase();
    const pool = catalog.filter((p) => p !== extra);
    const matched = !q ? pool : pool.filter((p) => p.toLowerCase().includes(q));
    return matched.map((name) => ({ name, source: 'catalog' as const }));
  };
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

export function JdTechnicalForm({
  form,
  onChange,
  uncertainKeys = [],
  disabled,
}: {
  form: JdTechnicalFormState;
  onChange: (patch: Partial<JdTechnicalFormState>) => void;
  uncertainKeys?: JdTechnicalFieldKey[];
  disabled?: boolean;
}) {
  const uncertain = new Set(uncertainKeys);
  const openJobFit = formHasTechnicalJobFit(form);
  const allWorkTypes = form.technicalWorkTypes.length === TECHNICAL_WORK_TYPES.length;

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <MatrixSection
        title={JD_TECHNICAL_GROUPS.A.title}
        subtitle={JD_TECHNICAL_GROUPS.A.subtitle}
        defaultOpen
      >
        <div>
          <NumberedFieldLabel
            title="1. Vị trí tuyển dụng"
            extra={<UncertainBadge show={uncertain.has('title')} />}
          />
          <Input
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="VD: Kỹ sư tự động hóa / Điều khiển"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {JD_TECHNICAL_TITLE_OPTIONS.map((opt) => (
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
            title="2. Lĩnh vực / ngành kỹ thuật"
            extra={<UncertainBadge show={uncertain.has('industries')} />}
          />
          <MultiCheck
            options={JD_TECHNICAL_INDUSTRY_OPTIONS}
            selected={form.industries}
            onChange={(industries) => onChange({ industries })}
            columns={2}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="3. Địa điểm làm việc"
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
            title="4. Kinh nghiệm yêu cầu"
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
            title="5. Mức thu nhập"
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
              title="6. Số lượng tuyển dụng"
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
              title="7. Hạn nộp hồ sơ"
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

      <MatrixSection
        title={JD_TECHNICAL_GROUPS.B.title}
        subtitle={JD_TECHNICAL_GROUPS.B.subtitle}
        defaultOpen
      >
        <div>
          <NumberedFieldLabel
            title="8. Thiết bị / hệ thống"
            description="Chỉ chọn mục JD nêu rõ — không suy diễn."
            extra={<UncertainBadge show={uncertain.has('equipmentSystems')} />}
          />
          <BrandTechnologySearch
            selected={form.equipmentSystems}
            onChange={(equipmentSystems) => onChange({ equipmentSystems })}
            suggest={suggestFromCatalog(EQUIPMENT_SYSTEM_OPTIONS)}
            placeholder="Tìm thiết bị / hệ thống (PLC, HVAC, điện công nghiệp…)"
            hint="Gõ để gợi ý. Không có trong danh sách — bấm “+ Thêm” nếu JD nêu tên cụ thể."
            emptyMessage="Gõ tên thiết bị để tìm trong danh mục"
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="9. Môi trường làm việc"
            extra={<UncertainBadge show={uncertain.has('workEnvironments')} />}
          />
          <MultiCheck
            options={WORK_ENVIRONMENT_OPTIONS}
            selected={form.workEnvironments}
            onChange={(workEnvironments) => onChange({ workEnvironments })}
            columns={2}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="10. Công việc kỹ thuật"
            extra={<UncertainBadge show={uncertain.has('technicalWorkTypes')} />}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                technicalWorkTypes: allWorkTypes ? [] : [...TECHNICAL_WORK_TYPES],
              })
            }
            className="mb-2 text-xs font-semibold text-brand-700 hover:underline"
          >
            {allWorkTypes ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </button>
          <MultiCheck
            options={TECHNICAL_WORK_TYPES}
            selected={form.technicalWorkTypes}
            onChange={(technicalWorkTypes) => onChange({ technicalWorkTypes })}
            columns={2}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="11. Mức độ tự chủ"
            description="Không hiện cấp bậc trên JD — chỉ mức tự chủ 1–5 khi JD mô tả."
            extra={<UncertainBadge show={uncertain.has('autonomyLevel')} />}
          />
          <PillGroup
            options={JD_TECHNICAL_AUTONOMY_OPTIONS.map((o) => ({
              value: String(o.value),
              label: `${o.value}. ${o.label}`,
            }))}
            value={form.autonomyLevel != null ? String(form.autonomyLevel) : ''}
            onChange={(v) => onChange({ autonomyLevel: Number(v) })}
          />
        </div>
      </MatrixSection>

      <MatrixSection
        title={JD_TECHNICAL_GROUPS.C.title}
        subtitle={JD_TECHNICAL_GROUPS.C.subtitle}
        defaultOpen={openJobFit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <NumberedFieldLabel
              title="12. Trình độ học vấn"
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
              title="13. Chuyên ngành"
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
            title="14. Ngoại ngữ"
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
            title="15. Chứng chỉ"
            extra={<UncertainBadge show={uncertain.has('certificates')} />}
          />
          <BrandTechnologySearch
            selected={form.certificates}
            onChange={(certificates) => onChange({ certificates })}
            suggest={suggestFromCatalog(JD_TECHNICAL_CERTIFICATE_OPTIONS)}
            placeholder="Tìm chứng chỉ (an toàn điện, PCCC…)"
            hint="Chỉ thêm khi JD nêu rõ."
            emptyMessage="Gõ tên chứng chỉ để tìm"
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="16. Giấy phép lái xe"
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
            title="17. Khả năng đi công tác"
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

        <div>
          <NumberedFieldLabel
            title="18. Làm ngoài giờ / xử lý sự cố"
            extra={<UncertainBadge show={uncertain.has('shiftFlexibility')} />}
          />
          <PillGroup
            options={JD_TECHNICAL_SHIFT_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={form.shiftFlexibility}
            onChange={(shiftFlexibility) => onChange({ shiftFlexibility })}
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="19. Công cụ / phần mềm"
            extra={<UncertainBadge show={uncertain.has('technicalTools')} />}
          />
          <BrandTechnologySearch
            selected={form.technicalTools}
            onChange={(technicalTools) => onChange({ technicalTools })}
            suggest={suggestFromCatalog(TECHNICAL_TOOLS)}
            placeholder="AutoCAD, SolidWorks, PLC / HMI…"
            hint="Chỉ chọn khi JD nêu."
            emptyMessage="Gõ tên phần mềm để tìm"
          />
        </div>

        <div>
          <NumberedFieldLabel
            title="20. Bản vẽ / tài liệu kỹ thuật"
            extra={<UncertainBadge show={uncertain.has('documentLiteracy')} />}
          />
          <MultiCheck
            options={DOCUMENT_LITERACY_OPTIONS}
            selected={form.documentLiteracy}
            onChange={(documentLiteracy) => onChange({ documentLiteracy })}
            columns={2}
          />
        </div>
      </MatrixSection>

      <MatrixSection
        title={JD_TECHNICAL_GROUPS.D.title}
        subtitle={JD_TECHNICAL_GROUPS.D.subtitle}
        defaultOpen
      >
        <div>
          <NumberedFieldLabel
            title="21. Mô tả công việc"
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
            title="22. Yêu cầu công việc"
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
            title="23. Quyền lợi / phúc lợi"
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
