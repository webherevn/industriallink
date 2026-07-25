'use client';

import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bot,
  Check,
  Lightbulb,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CAREER_LADDERS,
  DEPARTMENTS,
  EmploymentType,
  ExperienceBand,
  INDUSTRY_GROUPS,
  JOB_LEVEL_LABEL,
  JOB_TRACK_LABEL,
  JobLevelCode,
  JobTrack,
  SALARY_PRESETS,
} from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { AppShell } from '@/components/app-shell';
import { LocationPicker } from '@/components/location-picker';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { estimateSalary } from '@/lib/career';
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL, formatJobLevel, formatSalary } from '@/lib/format';
import { createJob, generateJobDraft } from '@/lib/jobs';

const STEPS = [
  { id: 1, label: 'Thông tin cơ bản' },
  { id: 2, label: 'Mô tả công việc' },
  { id: 3, label: 'Yêu cầu ứng viên' },
  { id: 4, label: 'Quyền lợi & phúc lợi' },
  { id: 5, label: 'Xem trước & đăng tin' },
] as const;

const TIPS = [
  'Tiêu đề rõ ràng, kèm kỹ năng / địa điểm nổi bật',
  'Mô tả cụ thể nhiệm vụ hàng ngày và môi trường nhà máy',
  'Nêu mức lương cạnh tranh hoặc khoảng thị trường',
  'Liệt kê phúc lợi: ca, hỗ trợ nhà ở, thưởng hiệu suất…',
];

type FormState = {
  title: string;
  industry: string;
  jobTrack: JobTrack | '';
  jobLevel: JobLevelCode | '';
  department: string;
  location: string;
  employmentType: EmploymentType;
  headcount: string;
  deadline: string;
  experienceBand: ExperienceBand;
  salaryMin: string;
  salaryMax: string;
  salaryPreset: string;
  description: string;
  requirements: string;
  skills: string;
  benefits: string;
  hints: string;
};

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'rounded-lg border px-3.5 py-2 text-sm font-medium transition',
            value === opt.value
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
            disabled && 'opacity-50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#1e46e0"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-brand-700">{percent}%</span>
      </div>
    </div>
  );
}

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [salaryHint, setSalaryHint] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    title: '',
    industry: '',
    jobTrack: JobTrack.Technical,
    jobLevel: JobLevelCode.TechStaff,
    department: 'Kỹ thuật',
    location: '',
    employmentType: EmploymentType.FullTime,
    headcount: '1',
    deadline: '',
    experienceBand: ExperienceBand.From1To3,
    salaryMin: '',
    salaryMax: '',
    salaryPreset: '',
    description: '',
    requirements: '',
    skills: '',
    benefits: '',
    hints: '',
  });

  const levelOptions = useMemo(() => {
    if (!form.jobTrack) return [];
    return CAREER_LADDERS[form.jobTrack];
  }, [form.jobTrack]);

  const stepDone = useMemo(() => {
    return {
      1:
        form.title.trim().length >= 3 &&
        Boolean(form.jobLevel) &&
        Boolean(form.location.trim() || form.industry),
      2: form.description.trim().length >= 10,
      3: form.requirements.trim().length >= 5 || form.skills.trim().length > 0,
      4: form.benefits.trim().length >= 5,
      5: false,
    };
  }, [form]);

  const completionPercent = useMemo(() => {
    const weights = [
      form.title.trim().length >= 3,
      Boolean(form.industry || form.jobTrack),
      Boolean(form.jobLevel),
      Boolean(form.location.trim()),
      form.description.trim().length >= 10,
      form.requirements.trim().length >= 5,
      form.benefits.trim().length >= 5,
      Boolean(form.salaryMin || form.salaryMax),
      Boolean(form.deadline),
      form.skills.trim().length > 0,
    ];
    const filled = weights.filter(Boolean).length;
    return Math.round((filled / weights.length) * 100);
  }, [form]);

  const patch = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

  const mutation = useMutation({
    mutationFn: (publish: boolean) =>
      createJob({
        title: form.title.trim(),
        description: form.description.trim() || '(Đang soạn mô tả)',
        requirements: form.requirements.trim() || undefined,
        benefits: form.benefits.trim() || undefined,
        industry: form.industry || undefined,
        department: form.department || undefined,
        jobLevel: form.jobLevel || undefined,
        employmentType: form.employmentType,
        location: form.location || undefined,
        headcount: form.headcount ? Number(form.headcount) : 1,
        deadline: form.deadline || undefined,
        experienceBand: form.experienceBand,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name, required: true })),
        publish,
      }),
    onSuccess: () => router.push('/recruiter'),
  });

  const titleAiMutation = useMutation({
    mutationFn: () =>
      generateJobDraft({
        title: form.title.trim() || 'Vị trí kỹ thuật công nghiệp',
        industry: form.industry || undefined,
        jobLevel: form.jobLevel || undefined,
        location: form.location || undefined,
        employmentType: form.employmentType,
        hints: `Chỉ đề xuất tiêu đề hấp dẫn bằng tiếng Việt. Ngành: ${form.industry || 'công nghiệp'}. Phòng ban: ${form.department}. Địa điểm: ${form.location || 'KCN Việt Nam'}.`,
      }),
    onSuccess: (draft) => {
      const suggested =
        draft.title?.trim() ||
        `${form.title || 'Kỹ sư'} — ${form.location || 'Nhà máy công nghiệp'}`;
      setAiSuggestion(suggested);
      if (!form.title.trim() && draft.title) {
        patch({ title: draft.title });
      }
    },
  });

  const jdAiMutation = useMutation({
    mutationFn: () =>
      generateJobDraft({
        title: form.title.trim(),
        industry: form.industry || undefined,
        jobLevel: form.jobLevel || undefined,
        location: form.location || undefined,
        employmentType: form.employmentType,
        hints: form.hints || undefined,
        existingDescription: form.description || undefined,
        existingRequirements: form.requirements || undefined,
        existingBenefits: form.benefits || undefined,
        existingSkills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (draft) => {
      patch({
        title: draft.title?.trim() || form.title,
        description: draft.description || form.description,
        requirements: draft.requirements || form.requirements,
        benefits: draft.benefits || form.benefits,
        skills:
          draft.skills.length > 0 ? draft.skills.map((s) => s.name).join(', ') : form.skills,
        salaryMin:
          draft.suggestedSalaryMin != null ? String(draft.suggestedSalaryMin) : form.salaryMin,
        salaryMax:
          draft.suggestedSalaryMax != null ? String(draft.suggestedSalaryMax) : form.salaryMax,
      });
      if (draft.suggestedSalaryMin && draft.suggestedSalaryMax) {
        setSalaryHint(
          `Gợi ý mức lương thị trường: ${formatSalary(draft.suggestedSalaryMin, draft.suggestedSalaryMax)}`,
        );
      }
    },
  });

  const reqAiMutation = useMutation({
    mutationFn: () =>
      generateJobDraft({
        title: form.title.trim() || 'Vị trí công nghiệp',
        industry: form.industry || undefined,
        jobLevel: form.jobLevel || undefined,
        location: form.location || undefined,
        employmentType: form.employmentType,
        hints: [
          'Ưu tiên soạn phần YÊU CẦU ỨNG VIÊN và danh sách KỸ NĂNG.',
          'Viết dạng gạch đầu dòng rõ ràng: học vấn, kinh nghiệm, chứng chỉ, phẩm chất.',
          form.hints || null,
        ]
          .filter(Boolean)
          .join(' '),
        existingDescription: form.description || undefined,
        existingRequirements: form.requirements || undefined,
        existingSkills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: (draft) => {
      patch({
        requirements: draft.requirements || form.requirements,
        skills:
          draft.skills.length > 0 ? draft.skills.map((s) => s.name).join(', ') : form.skills,
      });
    },
  });

  const benefitsAiMutation = useMutation({
    mutationFn: () =>
      generateJobDraft({
        title: form.title.trim() || 'Vị trí công nghiệp',
        industry: form.industry || undefined,
        jobLevel: form.jobLevel || undefined,
        location: form.location || undefined,
        employmentType: form.employmentType,
        hints: [
          'Ưu tiên soạn phần QUYỀN LỢI & PHÚC LỢI cho nhà máy / KCN Việt Nam.',
          'Gồm: lương thưởng, BHXH, hỗ trợ nhà ở/xe, ca kíp, đào tạo, ATLĐ — dạng gạch đầu dòng.',
          form.hints || null,
        ]
          .filter(Boolean)
          .join(' '),
        existingDescription: form.description || undefined,
        existingBenefits: form.benefits || undefined,
      }),
    onSuccess: (draft) => {
      patch({
        benefits: draft.benefits || form.benefits,
      });
    },
  });

  const salaryMutation = useMutation({
    mutationFn: () =>
      estimateSalary({
        jobLevel: form.jobLevel as JobLevelCode,
        industry: form.industry || undefined,
        location: form.location || undefined,
        title: form.title.trim() || undefined,
      }),
    onSuccess: (est) => {
      patch({
        salaryMin: String(est.salaryMin),
        salaryMax: String(est.salaryMax),
        salaryPreset: 'Tuỳ chỉnh',
      });
      setSalaryHint(
        `Gợi ý mức lương thị trường: ${formatSalary(est.salaryMin, est.salaryMax)}`,
      );
    },
  });

  useEffect(() => {
    if (!form.jobLevel) return;
    const t = setTimeout(() => {
      salaryMutation.mutate();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ ước lại khi cấp bậc / ngành / địa điểm đổi
  }, [form.jobLevel, form.industry, form.location]);

  const busy =
    mutation.isPending ||
    titleAiMutation.isPending ||
    jdAiMutation.isPending ||
    reqAiMutation.isPending ||
    benefitsAiMutation.isPending ||
    salaryMutation.isPending;

  const canContinue = () => {
    if (step === 1) return form.title.trim().length >= 3;
    if (step === 2) return form.description.trim().length >= 10;
    return true;
  };

  const canPublish = form.title.trim().length >= 3 && form.description.trim().length >= 10;

  const error =
    mutation.error ??
    titleAiMutation.error ??
    jdAiMutation.error ??
    reqAiMutation.error ??
    benefitsAiMutation.error ??
    salaryMutation.error;

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đăng tin tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Soạn tin theo 5 bước — AI hỗ trợ tiêu đề, JD và mức lương thị trường.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || form.title.trim().length < 3}
          onClick={() => mutation.mutate(false)}
        >
          {mutation.isPending && mutation.variables === false ? 'Đang lưu...' : 'Lưu nháp'}
        </Button>
      </div>

      {/* Stepper */}
      <nav className="mt-6 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1 sm:gap-2">
          {STEPS.map((s, idx) => {
            const active = step === s.id;
            const done = step > s.id || (s.id < 5 && stepDone[s.id as 1 | 2 | 3 | 4]);
            return (
              <li key={s.id} className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition',
                    active && 'bg-brand-600 text-white',
                    !active && done && 'bg-brand-50 text-brand-700',
                    !active && !done && 'bg-slate-100 text-slate-500',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      active && 'bg-white/20',
                      !active && done && 'bg-brand-600 text-white',
                      !active && !done && 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {done && !active ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </span>
                  <span className="hidden md:inline">{s.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <span className="hidden h-px w-6 bg-slate-200 sm:block lg:w-10" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Thông tin cơ bản</h2>
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-200 text-brand-700 hover:bg-brand-50"
                  disabled={busy}
                  onClick={() => titleAiMutation.mutate()}
                >
                  <Wand2 className="h-4 w-4" />
                  {titleAiMutation.isPending ? 'Đang gợi ý...' : 'Gợi ý tiêu đề với AI'}
                </Button>
              </div>

              <Field label="Vị trí tuyển dụng *">
                <Input
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Kỹ sư cơ điện, Trưởng ca sản xuất..."
                  disabled={busy}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nhóm ngành">
                  <Select
                    value={form.industry}
                    onChange={(e) => {
                      patch({ industry: e.target.value });
                    }}
                    disabled={busy}
                  >
                    <option value="">-- Chọn nhóm ngành --</option>
                    {INDUSTRY_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Chức danh (Cấp bậc)">
                  <Select
                    value={form.jobLevel}
                    onChange={(e) =>
                      patch({ jobLevel: e.target.value as JobLevelCode })
                    }
                    disabled={busy || !form.jobTrack}
                  >
                    <option value="">-- Chọn cấp bậc --</option>
                    {levelOptions.map((code) => (
                      <option key={code} value={code}>
                        {JOB_LEVEL_LABEL[code]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {form.jobTrack && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Khối {JOB_TRACK_LABEL[form.jobTrack]}:{' '}
                  {CAREER_LADDERS[form.jobTrack].map((c) => JOB_LEVEL_LABEL[c]).join(' → ')}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phòng ban">
                  <Select
                    value={form.department}
                    onChange={(e) => patch({ department: e.target.value })}
                    disabled={busy}
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Địa điểm làm việc">
                  <LocationPicker
                    variant="field"
                    multiple
                    disabled={busy}
                    placeholder="-- Chọn địa điểm --"
                    value={parseJoinedLocations(form.location)}
                    onChange={(labels) =>
                      patch({ location: joinLocationLabels(labels) })
                    }
                  />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Hình thức làm việc</p>
                <PillGroup
                  value={form.employmentType}
                  onChange={(employmentType) => patch({ employmentType })}
                  disabled={busy}
                  options={[
                    { value: EmploymentType.FullTime, label: EMPLOYMENT_LABEL[EmploymentType.FullTime] },
                    { value: EmploymentType.PartTime, label: EMPLOYMENT_LABEL[EmploymentType.PartTime] },
                    { value: EmploymentType.Internship, label: EMPLOYMENT_LABEL[EmploymentType.Internship] },
                    { value: EmploymentType.Seasonal, label: EMPLOYMENT_LABEL[EmploymentType.Seasonal] },
                  ]}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Số lượng tuyển">
                  <Input
                    type="number"
                    min={1}
                    value={form.headcount}
                    onChange={(e) => patch({ headcount: e.target.value })}
                    disabled={busy}
                  />
                </Field>
                <Field label="Hạn nộp hồ sơ">
                  <Input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => patch({ deadline: e.target.value })}
                    disabled={busy}
                  />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Kinh nghiệm</p>
                <PillGroup
                  value={form.experienceBand}
                  onChange={(experienceBand) => patch({ experienceBand })}
                  disabled={busy}
                  options={Object.values(ExperienceBand).map((b) => ({
                    value: b,
                    label: EXPERIENCE_LABEL[b],
                  }))}
                />
              </div>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">Mức lương</span>
                  {salaryHint && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      {salaryHint}
                    </span>
                  )}
                </div>
                <Select
                  value={form.salaryPreset}
                  onChange={(e) => {
                    const preset = SALARY_PRESETS.find((p) => p.label === e.target.value);
                    if (!preset) return;
                    if (preset.min === '__custom__') {
                      patch({ salaryPreset: preset.label });
                      return;
                    }
                    patch({
                      salaryPreset: preset.label,
                      salaryMin: preset.min,
                      salaryMax: preset.max,
                    });
                  }}
                  disabled={busy}
                >
                  <option value="">-- Chọn khoảng lương --</option>
                  {SALARY_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                {(form.salaryPreset === 'Tuỳ chỉnh' ||
                  (!form.salaryPreset && (form.salaryMin || form.salaryMax))) && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      type="number"
                      placeholder="Lương tối thiểu"
                      value={form.salaryMin}
                      onChange={(e) => patch({ salaryMin: e.target.value })}
                      disabled={busy}
                    />
                    <Input
                      type="number"
                      placeholder="Lương tối đa"
                      value={form.salaryMax}
                      onChange={(e) => patch({ salaryMax: e.target.value })}
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Mô tả công việc</h2>
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-200 text-brand-700 hover:bg-brand-50"
                  disabled={busy || form.title.trim().length < 3}
                  onClick={() => jdAiMutation.mutate()}
                >
                  <Sparkles className="h-4 w-4" />
                  {jdAiMutation.isPending ? 'AI đang soạn...' : 'Gợi ý JD với AI'}
                </Button>
              </div>
              <Field label="Mô tả công việc *">
                <Textarea
                  rows={10}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Mô tả trách nhiệm chính, môi trường làm việc, ca kíp..."
                  disabled={busy}
                />
              </Field>
              <Field label="Gợi ý thêm cho AI (tuỳ chọn)">
                <Textarea
                  rows={2}
                  value={form.hints}
                  onChange={(e) => patch({ hints: e.target.value })}
                  placeholder="Ví dụ: ưu tiên biết tiếng Trung, làm việc tại KCN 3 ca..."
                  disabled={busy}
                />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Yêu cầu ứng viên</h2>
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-200 text-brand-700 hover:bg-brand-50"
                  disabled={busy || form.title.trim().length < 3}
                  onClick={() => reqAiMutation.mutate()}
                >
                  <Sparkles className="h-4 w-4" />
                  {reqAiMutation.isPending ? 'AI đang soạn...' : 'Gợi ý yêu cầu với AI'}
                </Button>
              </div>
              <Field label="Yêu cầu chi tiết">
                <Textarea
                  rows={8}
                  value={form.requirements}
                  onChange={(e) => patch({ requirements: e.target.value })}
                  placeholder="Học vấn, chứng chỉ, kỹ năng cứng/mềm, yêu cầu khác..."
                  disabled={busy}
                />
              </Field>
              <Field label="Kỹ năng (phân tách bằng dấu phẩy)">
                <Input
                  value={form.skills}
                  onChange={(e) => patch({ skills: e.target.value })}
                  placeholder="PLC, SCADA, Siemens, AutoCAD..."
                  disabled={busy}
                />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Quyền lợi & phúc lợi</h2>
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-200 text-brand-700 hover:bg-brand-50"
                  disabled={busy || form.title.trim().length < 3}
                  onClick={() => benefitsAiMutation.mutate()}
                >
                  <Sparkles className="h-4 w-4" />
                  {benefitsAiMutation.isPending ? 'AI đang soạn...' : 'Gợi ý phúc lợi với AI'}
                </Button>
              </div>
              <Field label="Phúc lợi">
                <Textarea
                  rows={10}
                  value={form.benefits}
                  onChange={(e) => patch({ benefits: e.target.value })}
                  placeholder={
                    'Ví dụ:\n• Lương tháng 13, thưởng hiệu suất\n• Bảo hiểm đầy đủ, khám sức khoẻ định kỳ\n• Hỗ trợ nhà ở / xe đưa đón KCN\n• Đào tạo nội bộ, lộ trình thăng tiến'
                  }
                  disabled={busy}
                />
              </Field>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">Xem trước & đăng tin</h2>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Tiêu đề
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {form.title || '— Chưa có tiêu đề —'}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                  {form.industry && (
                    <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                      {form.industry}
                    </span>
                  )}
                  {form.jobLevel && (
                    <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                      {formatJobLevel(form.jobLevel)}
                    </span>
                  )}
                  {form.department && (
                    <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                      {form.department}
                    </span>
                  )}
                  {form.location && (
                    <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                      {form.location}
                    </span>
                  )}
                  <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                    {EMPLOYMENT_LABEL[form.employmentType]}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                    {EXPERIENCE_LABEL[form.experienceBand]}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                    {form.headcount || 1} vị trí
                  </span>
                  {form.deadline && (
                    <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
                      Hạn: {form.deadline}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-brand-700">
                  {formatSalary(
                    form.salaryMin ? Number(form.salaryMin) : null,
                    form.salaryMax ? Number(form.salaryMax) : null,
                  )}
                </p>

                <PreviewBlock title="Mô tả công việc" body={form.description} />
                <PreviewBlock title="Yêu cầu" body={form.requirements} />
                {form.skills.trim() && (
                  <PreviewBlock title="Kỹ năng" body={form.skills} />
                )}
                <PreviewBlock title="Quyền lợi & phúc lợi" body={form.benefits} />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error instanceof ApiError ? error.message : 'Có lỗi xảy ra'}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div className="flex gap-2">
              {step > 1 ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(step - 1)}>
                  Quay lại
                </Button>
              ) : (
                <Link href="/recruiter">
                  <Button type="button" variant="ghost">
                    Hủy
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Bước {step}/5</span>
              {step < 5 ? (
                <Button
                  type="button"
                  disabled={busy || !canContinue()}
                  onClick={() => setStep(step + 1)}
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy || !canPublish}
                  onClick={() => mutation.mutate(true)}
                >
                  {mutation.isPending ? 'Đang đăng...' : 'Đăng tin'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">ILV AI Assistant</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-brand-600">
                  Beta
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Gợi ý tiêu đề phù hợp ngành công nghiệp và địa điểm nhà máy.
            </p>
            {aiSuggestion ? (
              <div className="mt-3 rounded-xl border border-brand-100 bg-white p-3">
                <p className="text-sm font-medium text-slate-800">{aiSuggestion}</p>
                <Button
                  type="button"
                  className="mt-2 w-full"
                  disabled={busy}
                  onClick={() => patch({ title: aiSuggestion })}
                >
                  Áp dụng
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-brand-200 text-brand-700"
                disabled={busy}
                onClick={() => titleAiMutation.mutate()}
              >
                <Wand2 className="h-4 w-4" />
                {titleAiMutation.isPending ? 'Đang tạo...' : 'Tạo gợi ý'}
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Tiến độ hoàn thiện tin</p>
            <div className="mt-3 flex items-center gap-4">
              <ProgressRing percent={completionPercent} />
              <ul className="space-y-2 text-sm">
                {STEPS.map((s) => {
                  const done = s.id < 5 ? stepDone[s.id as 1 | 2 | 3 | 4] : canPublish;
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                          done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        {done ? <Check className="h-3 w-3" /> : s.id}
                      </span>
                      <span className={done ? 'text-slate-800' : 'text-slate-400'}>
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-slate-900">Mẹo để tin hiệu quả</p>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* Floating chatbot affordance */}
      <button
        type="button"
        onClick={() => titleAiMutation.mutate()}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
        aria-label="Mở trợ lý AI"
        title="Trợ lý AI"
      >
        <Bot className="h-7 w-7" />
      </button>
    </AppShell>
  );
}

function PreviewBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5 border-t border-slate-200/80 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {body.trim() || '— Chưa nhập —'}
      </p>
    </div>
  );
}
