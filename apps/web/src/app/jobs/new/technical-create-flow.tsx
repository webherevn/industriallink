'use client';

import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Check,
  FileUp,
  Loader2,
  Upload,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  JD_TECHNICAL_AUTONOMY_OPTIONS,
  JD_TECHNICAL_TOTAL_FIELDS,
  JobTrack,
  type JdTechnicalFieldKey,
  type ParsedTechnicalJobDraft,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { JdTechnicalForm } from '@/components/jd-technical-form';
import { JobTrackToggle } from '@/components/job-track-toggle';
import { CriteriaCompletionCard } from '@/components/progress-ring';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EXPERIENCE_LABEL, formatSalary } from '@/lib/format';
import {
  countFilledJdTechnicalFields,
  emptyJdTechnicalForm,
  formToCreateTechnicalJobRequest,
  parsedJobToTechnicalForm,
  type JdTechnicalFormState,
} from '@/lib/jd-technical-form';
import { createJob, parseJobFromFile, parseJobFromText } from '@/lib/jobs';

const JD_UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

const STEPS = [
  { id: 1, label: 'Nguồn JD' },
  { id: 2, label: 'Xác nhận 23 trường' },
  { id: 3, label: 'Xem trước & đăng' },
] as const;

const SAMPLE_JD = `Tuyển Kỹ sư tự động hóa / Điều khiển
Ngành: Tự động hóa & Điều khiển
Địa điểm: Hà Nội
Kinh nghiệm: 3-5 năm — Lương: 18-28 triệu — Số lượng: 2

Mô tả công việc:
Làm việc với Tự động hóa / Điều khiển tại Nhà máy / xưởng. Bảo trì / bảo dưỡng, Sửa chữa, Xử lý sự cố. Có thể tự xử lý công việc phức tạp. Dùng AutoCAD, đọc Bản vẽ điện.

Yêu cầu:
Tốt nghiệp Đại học chuyên ngành Điện – Tự động hóa. Có thể làm ngoài giờ hoặc xử lý sự cố khi cần.

Quyền lợi:
BHXH đầy đủ, hỗ trợ nhà ở.`;

function isTechnicalDraft(parsed: unknown): parsed is ParsedTechnicalJobDraft {
  return Boolean(parsed && typeof parsed === 'object' && 'equipmentSystems' in parsed);
}

export function JdTechnicalCreateFlow({
  onSwitchTrack,
}: {
  onSwitchTrack: (track: JobTrack) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [text, setText] = useState('');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uncertainKeys, setUncertainKeys] = useState<JdTechnicalFieldKey[]>([]);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const progress = useMemo(() => countFilledJdTechnicalFields(form), [form]);

  function patch(partial: Partial<JdTechnicalFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function applyParsed(parsed: Awaited<ReturnType<typeof parseJobFromText>>, fileName?: string) {
    if (!isTechnicalDraft(parsed)) {
      setParseError('AI trả về form Sales. Hãy chọn lại khối Kỹ thuật rồi phân tích.');
      return;
    }
    setForm(parsedJobToTechnicalForm(parsed));
    setUncertainKeys(parsed.uncertainKeys ?? []);
    setParseNote(
      parsed.notes ||
        (fileName
          ? `AI đã đọc ${fileName}. Hãy xác nhận các mục còn thiếu hoặc đánh dấu cần xác nhận.`
          : 'AI đã đọc nội dung JD. Hãy xác nhận các mục còn thiếu.'),
    );
    setParseError(null);
    setStep(2);
  }

  const fileMutation = useMutation({
    mutationFn: (file: File) => parseJobFromFile(file, JobTrack.Technical),
    onSuccess: (parsed, file) => {
      setUploadedName(file.name);
      applyParsed(parsed, file.name);
    },
    onError: (err) => {
      setParseError(err instanceof ApiError ? err.message : 'Không đọc được file JD');
    },
  });

  const textMutation = useMutation({
    mutationFn: () => parseJobFromText(text.trim(), JobTrack.Technical),
    onSuccess: (parsed) => applyParsed(parsed),
    onError: (err) => {
      setParseError(err instanceof ApiError ? err.message : 'Không phân tích được nội dung JD');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (publish: boolean) => createJob(formToCreateTechnicalJobRequest(form, publish)),
    onSuccess: () => router.push('/jobs/manage'),
  });

  const analyzing = fileMutation.isPending || textMutation.isPending;
  const busy = analyzing || saveMutation.isPending;
  const canPublish = form.title.trim().length >= 3 && form.description.trim().length >= 10;
  const autonomyLabel =
    form.autonomyLevel != null
      ? JD_TECHNICAL_AUTONOMY_OPTIONS.find((o) => o.value === form.autonomyLevel)?.label
      : null;

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Đăng tin tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload JD hoặc dán nội dung — AI điền 23 trường kỹ thuật, HR chỉ xác nhận.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || form.title.trim().length < 3}
          onClick={() => saveMutation.mutate(false)}
        >
          {saveMutation.isPending && saveMutation.variables === false ? 'Đang lưu...' : 'Lưu nháp'}
        </Button>
      </div>

      <JobTrackToggle value={JobTrack.Technical} onChange={onSwitchTrack} className="mt-4" />

      <nav className="mt-6 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1 sm:gap-2">
          {STEPS.map((s, idx) => {
            const active = step === s.id;
            const done = step > s.id;
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {step === 1 && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept={JD_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) fileMutation.mutate(file);
                  e.target.value = '';
                }}
              />

              <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
                      <FileUp className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Upload file JD</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        PDF, DOC, DOCX hoặc TXT · tối đa 5MB. AI chỉ điền mục có căn cứ trong file.
                      </p>
                      {uploadedName && (
                        <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-medium text-brand-700">
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                          {uploadedName}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    {fileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {fileMutation.isPending ? 'Đang đọc JD…' : 'Chọn file'}
                  </button>
                </div>
              </div>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    hoặc dán nội dung JD
                  </span>
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Dán mô tả tin tuyển dụng kỹ thuật tại đây (tối thiểu ~40 ký tự)…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={busy || text.trim().length < 40}
                  onClick={() => textMutation.mutate()}
                >
                  {textMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  AI điền 23 trường
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setText(SAMPLE_JD);
                  }}
                >
                  Dùng mẫu
                </Button>
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-500 hover:text-brand-700"
                  onClick={() => setStep(2)}
                >
                  Bỏ qua, điền tay →
                </button>
              </div>
              {parseError && (
                <p className="flex items-start gap-2 text-sm text-rose-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {parseError}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {parseNote && (
                <p className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
                  {parseNote}
                  {uncertainKeys.length > 0
                    ? ` ${uncertainKeys.length} mục cần xác nhận.`
                    : ''}
                </p>
              )}
              <JdTechnicalForm
                form={form}
                onChange={patch}
                uncertainKeys={uncertainKeys}
                disabled={busy}
              />
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">{form.title || 'Chưa có vị trí'}</h2>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-600">
                {form.industries.map((i) => (
                  <span key={i} className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                    {i}
                  </span>
                ))}
                {form.location && (
                  <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                    {form.location}
                  </span>
                )}
                {form.experienceBand && (
                  <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                    {EXPERIENCE_LABEL[form.experienceBand]}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-brand-700">
                {formatSalary(
                  form.salaryMin ? Number(form.salaryMin) : null,
                  form.salaryMax ? Number(form.salaryMax) : null,
                )}
              </p>
              {form.equipmentSystems.length > 0 && (
                <PreviewBlock title="Thiết bị / hệ thống" body={form.equipmentSystems.join(', ')} />
              )}
              {form.workEnvironments.length > 0 && (
                <PreviewBlock title="Môi trường làm việc" body={form.workEnvironments.join(', ')} />
              )}
              {form.technicalWorkTypes.length > 0 && (
                <PreviewBlock title="Công việc kỹ thuật" body={form.technicalWorkTypes.join(', ')} />
              )}
              {autonomyLabel && (
                <PreviewBlock
                  title="Mức độ tự chủ"
                  body={`Mức ${form.autonomyLevel}/5 · ${autonomyLabel}`}
                />
              )}
              <PreviewBlock title="Mô tả công việc" body={form.description} />
              <PreviewBlock title="Yêu cầu" body={form.requirements} />
              <PreviewBlock title="Quyền lợi" body={form.benefits} />
            </div>
          )}

          {saveMutation.isError && (
            <p className="mt-4 text-sm text-rose-600">
              {saveMutation.error instanceof ApiError
                ? saveMutation.error.message
                : 'Không lưu được tin tuyển dụng'}
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
              <span className="text-sm text-slate-400">Bước {step}/3</span>
              {step < 3 ? (
                <Button type="button" disabled={busy} onClick={() => setStep(step + 1)}>
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy || !canPublish}
                  onClick={() => saveMutation.mutate(true)}
                >
                  {saveMutation.isPending ? 'Đang đăng...' : 'Đăng tin'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <CriteriaCompletionCard
            title="Tiến độ điền JD"
            percent={progress.percent}
            filledCount={progress.filled}
            totalCount={JD_TECHNICAL_TOTAL_FIELDS}
            gaps={progress.missing.map((m) => ({
              key: m.key,
              label: m.label,
              status: 'missing' as const,
              value: null,
              suggestion: '',
            }))}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Gợi ý cho HR</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
              <li>AI không tự thêm thiết bị / môi trường / công việc kỹ thuật nếu JD không nêu.</li>
              <li>Nhóm C chỉ cần khi JD yêu cầu học vấn, chứng chỉ, bằng lái, công tác hoặc tài liệu kỹ thuật.</li>
              <li>Điểm matching ứng viên sẽ tính sau — form này chỉ thu thập 23 trường.</li>
            </ul>
          </div>
        </aside>
      </div>
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
