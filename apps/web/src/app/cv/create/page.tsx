'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileUp,
  Loader2,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Smartphone,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { CvDraftFieldHint, CvDraftView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { draftCvFromFile, draftCvFromText, getMyCandidate } from '@/lib/candidate';
import {
  CV_CREATE_STEPS,
  CV_TEMPLATE_FILTERS,
  CV_TEMPLATES,
  type CvDraft,
  type CvTemplate,
  type CvTemplateCategory,
} from '@/lib/cv-templates';

const SAMPLE_PROMPT = `Tôi tên Nguyễn Văn A, kỹ sư tự động hóa PLC/SCADA với 5 năm kinh nghiệm tại Công ty ABC (KCN Bắc Ninh).
Email: nguyenvana@email.com — SĐT: 0901 234 567.
Thành thạo Siemens S7, SCADA WinCC, bảo trì phòng ngừa và tối ưu OEE.
Tốt nghiệp Đại học Bách Khoa Hà Nội ngành Điện - Điện tử (2018–2022).
Có chứng chỉ An toàn lao động và ISO 9001 Awareness.
Dự án: nâng cấp hệ thống PLC dây chuyền đóng gói, giảm 18% thời gian đổi mã.`;

function toDraft(view: CvDraftView): CvDraft {
  return { ...view };
}

function emptyDraft(name: string, email: string): CvDraft {
  return {
    fullName: name,
    title: '',
    email,
    phone: '',
    location: '',
    summary: '',
    skills: [],
    softSkills: [],
    experience: [],
    education: [],
    certificates: [],
    projects: [],
  };
}

const CV_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export default function CreateCvPage() {
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [fields, setFields] = useState<CvDraftFieldHint[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [filter, setFilter] = useState<CvTemplateCategory>('all');
  const [selectedId, setSelectedId] = useState(CV_TEMPLATES[0].id);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<CvDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });

  const displayName = candidate?.displayName ?? me?.displayName ?? 'Ứng viên';
  const selected = CV_TEMPLATES.find((t) => t.id === selectedId) ?? CV_TEMPLATES[0];
  const activeDraft = draft ?? emptyDraft(displayName, me?.email ?? '');

  const templates = useMemo(
    () =>
      filter === 'all' ? CV_TEMPLATES : CV_TEMPLATES.filter((t) => t.category === filter),
    [filter],
  );

  const missingFields = fields.filter((f) => f.status === 'missing');
  const weakFields = fields.filter((f) => f.status === 'weak');
  const filledFields = fields.filter((f) => f.status === 'filled');

  function applyAnalyzeResult(res: Awaited<ReturnType<typeof draftCvFromText>>) {
    setDraft(toDraft(res.draft));
    setFields(res.fields);
    setAnalyzeMessage(res.message);
    setAiScore(res.aiScore);
    setAnalyzed(true);
  }

  const analyzeMutation = useMutation({
    mutationFn: draftCvFromText,
    onSuccess: applyAnalyzeResult,
  });

  const uploadMutation = useMutation({
    mutationFn: draftCvFromFile,
    onSuccess: applyAnalyzeResult,
  });

  const analyzing = analyzeMutation.isPending || uploadMutation.isPending;
  const analyzeError = analyzeMutation.error ?? uploadMutation.error;

  function onAnalyze() {
    uploadMutation.reset();
    analyzeMutation.mutate(rawText.trim());
  }

  function onPickFile(file: File | undefined) {
    if (!file || analyzing) return;
    analyzeMutation.reset();
    setUploadedName(file.name);
    uploadMutation.mutate(file);
  }

  function clearUpload() {
    setUploadedName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function updateDraft<K extends keyof CvDraft>(key: K, value: CvDraft[K]) {
    setDraft((prev) => ({ ...(prev ?? activeDraft), [key]: value }));
  }

  function goToTemplates() {
    if (!draft) setDraft(activeDraft);
    setStep(2);
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <CandidateSidebar
          displayName={displayName}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
          showProfileCard={false}
        />

        <section className="min-w-0 space-y-4 animate-soft-rise">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tạo CV bằng AI</h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload CV có sẵn hoặc nhập tự do — AI trích xuất các trường và gợi ý phần còn thiếu.
            </p>
          </div>

          <Stepper current={step} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="progress-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Bước 1: Nhập thông tin
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload file CV để AI phân tích ngay, hoặc viết tự nhiên bên dưới.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRawText(SAMPLE_PROMPT)}
                    className="text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Dùng ví dụ mẫu
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CV_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    onPickFile(file);
                  }}
                />

                <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
                        <FileUp className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Upload CV của bạn</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          PDF, DOC, DOCX hoặc TXT · tối đa 5MB
                        </p>
                        {uploadedName && (
                          <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs font-medium text-brand-700">
                            <Upload className="h-3.5 w-3.5 shrink-0" />
                            {uploadedName}
                            {!uploadMutation.isPending && (
                              <button
                                type="button"
                                onClick={clearUpload}
                                className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-600"
                                aria-label="Xóa file đã chọn"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {uploadMutation.isPending ? 'Đang phân tích CV…' : 'Chọn file CV'}
                    </button>
                  </div>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      hoặc nhập văn bản tự do
                    </span>
                  </div>
                </div>

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={10}
                  disabled={analyzing}
                  placeholder="Ví dụ: Tôi tên …, làm kỹ sư PLC 5 năm tại … Email … Thành thạo … Tốt nghiệp …"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm leading-relaxed text-slate-800 outline-none ring-brand-500/25 placeholder:text-slate-400 focus:bg-white focus:ring-2 disabled:opacity-60"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={rawText.trim().length < 40 || analyzing}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {analyzeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {analyzeMutation.isPending ? 'Đang phân tích…' : 'Phân tích bằng AI'}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Tối thiểu ~40 ký tự · {rawText.trim().length} ký tự hiện tại
                  </p>
                </div>

                {analyzeError && (
                  <p className="mt-3 text-sm text-rose-600">
                    {analyzeError instanceof ApiError
                      ? analyzeError.message
                      : 'Không phân tích được. Thử lại sau.'}
                  </p>
                )}
              </div>

              {analyzed && (
                <div className="progress-card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Kết quả AI trích xuất</h2>
                      <p className="mt-1 text-xs text-slate-500">{analyzeMessage}</p>
                    </div>
                    {aiScore != null && (
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                        Điểm AI {aiScore}/100
                      </span>
                    )}
                  </div>

                  {(missingFields.length > 0 || weakFields.length > 0) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Gợi ý bổ sung / tối ưu
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {[...missingFields, ...weakFields].map((f) => (
                          <li key={f.key} className="text-xs text-amber-900/90">
                            <span className="font-semibold">{f.label}</span>
                            <span className="text-amber-700"> — {f.suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {filledFields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {filledFields.map((f) => (
                        <span
                          key={f.key}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
                        >
                          <Check className="h-3 w-3" />
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Họ và tên"
                      value={activeDraft.fullName}
                      onChange={(v) => updateDraft('fullName', v)}
                      hint={fields.find((f) => f.key === 'fullName')}
                    />
                    <Field
                      label="Vị trí ứng tuyển"
                      value={activeDraft.title}
                      onChange={(v) => updateDraft('title', v)}
                      hint={fields.find((f) => f.key === 'title')}
                    />
                    <Field
                      label="Email"
                      value={activeDraft.email}
                      onChange={(v) => updateDraft('email', v)}
                      hint={fields.find((f) => f.key === 'email')}
                    />
                    <Field
                      label="Số điện thoại"
                      value={activeDraft.phone}
                      onChange={(v) => updateDraft('phone', v)}
                      hint={fields.find((f) => f.key === 'phone')}
                    />
                    <Field
                      label="Địa điểm"
                      value={activeDraft.location}
                      onChange={(v) => updateDraft('location', v)}
                      hint={fields.find((f) => f.key === 'location')}
                    />
                    <Field
                      label="Kỹ năng (phẩy)"
                      value={activeDraft.skills.join(', ')}
                      onChange={(v) =>
                        updateDraft(
                          'skills',
                          v
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        )
                      }
                      hint={fields.find((f) => f.key === 'skills')}
                    />
                  </div>

                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      Giới thiệu bản thân
                      <FieldStatusDot hint={fields.find((f) => f.key === 'summary')} />
                    </span>
                    <textarea
                      rows={4}
                      value={activeDraft.summary}
                      onChange={(e) => updateDraft('summary', e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                    />
                  </label>

                  <label className="block">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      Kinh nghiệm (mô tả ngắn)
                      <FieldStatusDot hint={fields.find((f) => f.key === 'experience')} />
                    </span>
                    <textarea
                      rows={3}
                      value={activeDraft.experience[0]?.bullets ?? ''}
                      onChange={(e) =>
                        updateDraft('experience', [
                          {
                            role: activeDraft.title || 'Vị trí',
                            company: activeDraft.experience[0]?.company || 'Công ty',
                            period: activeDraft.experience[0]?.period || '',
                            bullets: e.target.value,
                          },
                        ])
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <Link
                      href="/dashboard"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Hủy tạo CV
                    </Link>
                    <button
                      type="button"
                      onClick={goToTemplates}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
                    >
                      Tiếp tục chọn mẫu
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="progress-card p-5">
              <h2 className="text-sm font-bold text-slate-900">Bước 2: Chọn mẫu CV yêu thích</h2>
              <p className="mt-1 text-xs text-slate-500">
                Nội dung đã lấy từ bước AI — chọn mẫu rồi xem trước bên phải.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {CV_TEMPLATE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={clsx(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                      filter === f.id
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Theo ngành nghề
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={tpl.id === selectedId}
                    onSelect={() => setSelectedId(tpl.id)}
                  />
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Quay lại chỉnh nội dung
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
                >
                  Tiếp tục
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="progress-card p-5">
              <h2 className="text-sm font-bold text-slate-900">Bước 3: Xem trước & tải xuống</h2>
              <p className="mt-1 text-xs text-slate-500">
                Mẫu <strong>{selected.name}</strong> đã gắn với nội dung AI của bạn.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sửa nội dung
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đổi mẫu
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
                >
                  <Download className="h-4 w-4" />
                  Tải xuống CV
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden print:block xl:block">
          <div className="sticky top-4 space-y-3 animate-soft-rise [animation-delay:60ms] print:static">
            <div className="progress-card overflow-hidden p-0 print:border-0 print:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 print:hidden">
                <h2 className="text-sm font-bold text-slate-900">Xem trước CV</h2>
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={clsx(
                      'rounded-md p-1.5',
                      previewMode === 'desktop' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400',
                    )}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={clsx(
                      'rounded-md p-1.5',
                      previewMode === 'mobile' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400',
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div
                className={clsx(
                  'bg-slate-100/80 p-3 print:bg-white print:p-0',
                  previewMode === 'mobile' && 'flex justify-center',
                )}
              >
                <div
                  className={clsx(
                    'overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/80 print:shadow-none print:ring-0',
                    previewMode === 'mobile' ? 'w-[240px] print:w-full' : 'w-full',
                  )}
                >
                  <CvPreview
                    draft={activeDraft}
                    template={selected}
                    compact={previewMode === 'mobile'}
                    empty={!analyzed && step === 1}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t border-slate-100 p-4 print:hidden">
                <p className="text-center text-xs text-slate-500">
                  {analyzed ? 'Hài lòng với CV này?' : 'Phân tích AI để xem trước nội dung thật'}
                </p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!analyzed}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải xuống CV
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-4 xl:hidden print:hidden">
        <div className="progress-card p-3">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Xem trước CV</h2>
          <CvPreview draft={activeDraft} template={selected} empty={!analyzed && step === 1} />
        </div>
      </div>
    </AppShell>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="progress-card flex flex-wrap items-center gap-2 px-4 py-3">
      {CV_CREATE_STEPS.map((s, idx) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li key={s.id} className="flex min-w-0 items-center gap-2">
            {idx > 0 && <span className="hidden h-px w-6 bg-slate-200 sm:block" />}
            <span
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                done || active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : s.id}
            </span>
            <span
              className={clsx(
                'truncate text-xs font-semibold',
                active ? 'text-brand-600' : 'text-slate-500',
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FieldStatusDot({ hint }: { hint?: CvDraftFieldHint }) {
  if (!hint) return null;
  return (
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
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: CvDraftFieldHint;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        {label}
        <FieldStatusDot hint={hint} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint?.status === 'missing' ? hint.suggestion : undefined}
        className={clsx(
          'mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2',
          hint?.status === 'missing'
            ? 'border-rose-200'
            : hint?.status === 'weak'
              ? 'border-amber-200'
              : 'border-slate-200',
        )}
      />
    </label>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: CvTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        'group relative overflow-hidden rounded-xl border-2 bg-white text-left transition',
        selected
          ? 'border-brand-500 shadow-md shadow-brand-500/10'
          : 'border-slate-200 hover:border-brand-200 hover:shadow-sm',
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 z-10 rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
          Được chọn
        </span>
      )}
      <div className="aspect-[3/4] bg-slate-50 p-2.5">
        <MiniTemplateThumb template={template} />
      </div>
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="text-xs font-bold text-slate-800">{template.name}</p>
        <p className="mt-0.5 text-[10px] capitalize text-slate-400">{template.category}</p>
      </div>
    </button>
  );
}

function MiniTemplateThumb({ template }: { template: CvTemplate }) {
  if (template.layout === 'sidebar') {
    return (
      <div className="flex h-full overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="w-[32%]" style={{ backgroundColor: template.accent }}>
          <div className="mx-auto mt-2 h-4 w-4 rounded-full bg-white/30" />
          <div className="mx-1.5 mt-2 space-y-1">
            <div className="h-1 rounded bg-white/40" />
            <div className="h-1 w-3/4 rounded bg-white/25" />
          </div>
        </div>
        <div className="flex-1 space-y-1.5 p-2">
          <div className="h-2 w-2/3 rounded" style={{ backgroundColor: template.accent }} />
          <div className="h-1 rounded bg-slate-200" />
          <div className="h-1 w-5/6 rounded bg-slate-100" />
        </div>
      </div>
    );
  }
  if (template.layout === 'split') {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="h-[22%]" style={{ backgroundColor: template.accent }} />
        <div className="grid flex-1 grid-cols-2 gap-1 p-2">
          <div className="space-y-1">
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1 rounded bg-slate-100" />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md bg-white p-2 shadow-sm ring-1 ring-slate-200/80">
      <div className="h-2 w-1/2 rounded" style={{ backgroundColor: template.accent }} />
      <div className="mt-2 space-y-1">
        <div className="h-1 rounded bg-slate-100" />
        <div className="h-1 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function CvPreview({
  draft,
  template,
  compact,
  empty,
}: {
  draft: CvDraft;
  template: CvTemplate;
  compact?: boolean;
  empty?: boolean;
}) {
  if (empty) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 bg-white p-6 text-center">
        <Sparkles className="h-8 w-8 text-brand-300" />
        <p className="text-xs font-semibold text-slate-600">Chưa có nội dung CV</p>
        <p className="text-[11px] text-slate-400">
          Nhập text và bấm Phân tích bằng AI để xem trước.
        </p>
      </div>
    );
  }

  const text = compact ? 'text-[7px]' : 'text-[9px]';

  return (
    <div className={clsx('flex min-h-[360px] bg-white text-slate-800', text)}>
      <aside
        className={clsx('shrink-0 text-white', compact ? 'w-[38%] p-2' : 'w-[36%] p-3')}
        style={{ backgroundColor: template.accent }}
      >
        <div
          className={clsx(
            'mx-auto flex items-center justify-center rounded-full bg-white/20 font-bold',
            compact ? 'h-10 w-10 text-[10px]' : 'h-14 w-14 text-sm',
          )}
        >
          {(draft.fullName || 'UV')
            .split(/\s+/)
            .map((w) => w[0])
            .slice(-2)
            .join('')
            .toUpperCase()}
        </div>
        <p className={clsx('mt-2 text-center font-extrabold leading-tight', compact ? 'text-[9px]' : 'text-[11px]')}>
          {draft.fullName || 'HỌ TÊN'}
        </p>
        <p className="mt-0.5 text-center text-[8px] uppercase tracking-wide text-white/80">
          {draft.title || 'Vị trí'}
        </p>
        <div className="mt-3 space-y-1.5 text-[8px] text-white/90">
          <p className="flex items-center gap-1">
            <Mail className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{draft.email || 'email'}</span>
          </p>
          <p className="flex items-center gap-1">
            <Phone className="h-2.5 w-2.5 shrink-0" /> {draft.phone || 'SĐT'}
          </p>
          <p className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" /> {draft.location || 'Địa điểm'}
          </p>
        </div>
        <p className="mt-3 text-[8px] font-bold uppercase tracking-wide text-white/70">
          Kỹ năng chuyên môn
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {(draft.skills.length ? draft.skills : ['Chưa có']).slice(0, 5).map((s, i) => (
            <li key={s + i}>
              <p className="truncate text-[8px]">{s}</p>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/80" style={{ width: `${88 - i * 8}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className={clsx('min-w-0 flex-1', compact ? 'p-2' : 'p-3')}>
        <Section title="Giới thiệu" accent={template.accent}>
          {draft.summary || 'Chưa có giới thiệu'}
        </Section>
        <Section title="Kinh nghiệm làm việc" accent={template.accent}>
          {draft.experience.length === 0 ? (
            <p className="text-[8px] text-slate-400">Chưa có kinh nghiệm</p>
          ) : (
            draft.experience.map((e) => (
              <div key={e.role + e.company} className="mb-2">
                <p className="font-bold text-[9px]">
                  {e.role} — {e.company}
                </p>
                <p className="text-[8px] text-slate-400">{e.period}</p>
                <p className="mt-0.5 whitespace-pre-line text-[8px] leading-relaxed text-slate-600">
                  {e.bullets}
                </p>
              </div>
            ))
          )}
        </Section>
        <Section title="Học vấn" accent={template.accent}>
          {draft.education.length === 0 ? (
            <p className="text-[8px] text-slate-400">Chưa có học vấn</p>
          ) : (
            draft.education.map((e) => (
              <div key={e.school} className="mb-1">
                <p className="font-bold text-[9px]">{e.school}</p>
                <p className="text-[8px] text-slate-600">
                  {e.degree} · {e.period}
                </p>
              </div>
            ))
          )}
        </Section>
        {draft.certificates.length > 0 && (
          <Section title="Chứng chỉ" accent={template.accent}>
            <ul className="list-disc space-y-0.5 pl-3 text-[8px]">
              {draft.certificates.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-2.5">
      <p
        className="border-b pb-0.5 text-[8px] font-bold uppercase tracking-wide"
        style={{ color: accent, borderColor: `${accent}33` }}
      >
        {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
