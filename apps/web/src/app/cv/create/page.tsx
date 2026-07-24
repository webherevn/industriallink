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
  Monitor,
  Save,
  Smartphone,
  UserRound,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import type { CvDraftFieldHint, CvDraftView } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { CvPreview } from '@/components/cv-preview';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { downloadElementAsPdf } from '@/lib/download-cv';
import { draftCvFromFile, draftCvFromText, getMyCandidate, saveCvDraftToProfile } from '@/lib/candidate';
import {
  candidateHasCvSource,
  draftFromCandidate,
  fieldHintsFromDraft,
} from '@/lib/cv-from-profile';
import {
  CV_CREATE_STEPS,
  CV_TEMPLATE_FILTERS,
  CV_TEMPLATES,
  emptyCvDraft,
  normalizeCvDraft,
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
  return normalizeCvDraft(view);
}

function emptyDraft(name: string, email: string): CvDraft {
  return emptyCvDraft(name, email);
}

function splitCsv(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CV_UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<'ai' | 'profile' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const fieldsCardRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading: candidateLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });

  const displayName = candidate?.displayName ?? me?.displayName ?? 'Ứng viên';
  const selected = CV_TEMPLATES.find((t) => t.id === selectedId) ?? CV_TEMPLATES[0];
  const activeDraft = draft ?? emptyDraft(displayName, me?.email ?? '');
  const canImportFromProfile = candidateHasCvSource(candidate);

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
    setImportSource('ai');
    setImportError(null);
  }

  function importFromProfile() {
    setImportError(null);
    if (!candidate) {
      setImportError('Chưa có hồ sơ ứng viên. Hãy hoàn thiện hồ sơ trước.');
      return;
    }
    if (!candidateHasCvSource(candidate)) {
      setImportError('Hồ sơ còn trống. Cập nhật hồ sơ rồi thử lại.');
      return;
    }
    const next = draftFromCandidate(candidate, me?.email ?? '');
    setDraft(next);
    setFields(fieldHintsFromDraft(next));
    setAnalyzeMessage(
      'Đã nạp thông tin từ hồ sơ của bạn. Kiểm tra các trường bên dưới rồi tiếp tục chọn mẫu CV.',
    );
    setAiScore(null);
    setAnalyzed(true);
    setImportSource('profile');
    window.setTimeout(() => {
      fieldsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function updateExperience(
    index: number,
    patch: Partial<CvDraft['experience'][number]>,
  ) {
    setDraft((prev) => {
      const base = prev ?? activeDraft;
      const experience = base.experience.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      );
      return { ...base, experience };
    });
  }

  const analyzeMutation = useMutation({
    mutationFn: draftCvFromText,
    onSuccess: applyAnalyzeResult,
  });

  const uploadMutation = useMutation({
    mutationFn: draftCvFromFile,
    onSuccess: applyAnalyzeResult,
  });

  const saveMutation = useMutation({
    mutationFn: () => saveCvDraftToProfile(activeDraft),
    onSuccess: (res) => {
      setSaveError(null);
      setSaveMessage(res.message);
    },
    onError: (err) => {
      setSaveMessage(null);
      setSaveError(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ');
    },
  });

  const analyzing = analyzeMutation.isPending || uploadMutation.isPending;
  const analyzeError = analyzeMutation.error ?? uploadMutation.error;

  function onSaveToProfile() {
    setSaveMessage(null);
    setSaveError(null);
    if (!draft && !analyzed) {
      setSaveError('Hãy phân tích / nhập nội dung CV trước khi lưu hồ sơ.');
      return;
    }
    saveMutation.mutate();
  }

  async function onDownloadCv() {
    setDownloadError(null);
    const el = cvPreviewRef.current;
    if (!el) {
      setDownloadError('Không tìm thấy bản xem trước CV để tải.');
      return;
    }
    if (!analyzed && !draft) {
      setDownloadError('Hãy phân tích nội dung CV trước khi tải xuống.');
      return;
    }
    setDownloading(true);
    try {
      const name = (activeDraft.fullName || 'CV').trim();
      await downloadElementAsPdf(el, `CV-${name}`);
    } catch {
      setDownloadError('Không tải được PDF. Thử lại hoặc dùng trình duyệt khác.');
    } finally {
      setDownloading(false);
    }
  }

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
              Nạp từ hồ sơ, upload CV có sẵn hoặc nhập tự do — chỉnh sửa trường, chọn mẫu rồi tải
              PDF.
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
                      Nạp từ hồ sơ đã lưu, upload file CV, hoặc viết tự nhiên bên dưới.
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

                <div className="mt-4 rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50/80 to-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          Nhập thông tin từ hồ sơ
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Điền sẵn họ tên, liên hệ, kỹ năng, kinh nghiệm công ty, học vấn từ hồ sơ
                          đã cập nhật — rồi chọn mẫu và tải CV.
                        </p>
                        {candidate && (
                          <p className="mt-1.5 text-[11px] font-medium text-brand-700">
                            {candidate.experiences.length} kinh nghiệm ·{' '}
                            {candidate.skills.length} kỹ năng · hồ sơ{' '}
                            {candidate.profileCompletion}%
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={candidateLoading || analyzing || !canImportFromProfile}
                      onClick={importFromProfile}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserRound className="h-4 w-4" />
                      {candidateLoading ? 'Đang tải hồ sơ…' : 'Dùng hồ sơ của tôi'}
                    </button>
                  </div>
                  {importError && (
                    <p className="mt-3 text-sm text-rose-600">{importError}</p>
                  )}
                  {!candidateLoading && !canImportFromProfile && (
                    <p className="mt-3 text-xs text-amber-700">
                      Hồ sơ còn trống.{' '}
                      <Link href="/profile/edit" className="font-semibold underline">
                        Cập nhật hồ sơ
                      </Link>{' '}
                      rồi quay lại đây.
                    </p>
                  )}
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

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      hoặc upload / nhập văn bản
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-4">
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
                <div ref={fieldsCardRef} className="progress-card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        {importSource === 'profile'
                          ? 'Thông tin từ hồ sơ'
                          : 'Kết quả AI trích xuất'}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{analyzeMessage}</p>
                    </div>
                    {aiScore != null && (
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                        Điểm AI {aiScore}/100
                      </span>
                    )}
                    {importSource === 'profile' && (
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                        Từ hồ sơ
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
                      onChange={(v) => updateDraft('skills', splitCsv(v))}
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

                  <div>
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      Kinh nghiệm làm việc
                      <FieldStatusDot hint={fields.find((f) => f.key === 'experience')} />
                    </span>
                    {activeDraft.experience.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Chưa có kinh nghiệm. Thêm trong hồ sơ hoặc mô tả sau khi phân tích AI.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-3">
                        {activeDraft.experience.map((exp, index) => (
                          <div
                            key={`${exp.company}-${exp.role}-${index}`}
                            className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                          >
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input
                                value={exp.role}
                                onChange={(e) =>
                                  updateExperience(index, { role: e.target.value })
                                }
                                placeholder="Vị trí"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                              <input
                                value={exp.company}
                                onChange={(e) =>
                                  updateExperience(index, { company: e.target.value })
                                }
                                placeholder="Công ty"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                              <input
                                value={exp.period}
                                onChange={(e) =>
                                  updateExperience(index, { period: e.target.value })
                                }
                                placeholder="Thời gian"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <input
                                value={exp.productsSold.join(', ')}
                                onChange={(e) =>
                                  updateExperience(index, {
                                    productsSold: splitCsv(e.target.value),
                                  })
                                }
                                placeholder="Sản phẩm bán (phẩy)"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                              <input
                                value={exp.customerSegments.join(', ')}
                                onChange={(e) =>
                                  updateExperience(index, {
                                    customerSegments: splitCsv(e.target.value),
                                  })
                                }
                                placeholder="Tệp KH (phẩy)"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                              <input
                                value={exp.marketsCovered.join(', ')}
                                onChange={(e) =>
                                  updateExperience(index, {
                                    marketsCovered: splitCsv(e.target.value),
                                  })
                                }
                                placeholder="Thị trường (phẩy)"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                              <input
                                value={exp.sellingStages.join(', ')}
                                onChange={(e) =>
                                  updateExperience(index, {
                                    sellingStages: splitCsv(e.target.value),
                                  })
                                }
                                placeholder="Giai đoạn bán (phẩy)"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                              />
                            </div>
                            <textarea
                              rows={3}
                              value={exp.bullets}
                              onChange={(e) =>
                                updateExperience(index, { bullets: e.target.value })
                              }
                              placeholder="Mô tả công việc / thành tích (mỗi dòng 1 ý)"
                              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none ring-brand-500/30 focus:ring-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Sản phẩm bán (tổng hợp)"
                      value={activeDraft.productsSold.join(', ')}
                      onChange={(v) => updateDraft('productsSold', splitCsv(v))}
                      hint={fields.find((f) => f.key === 'products')}
                    />
                    <Field
                      label="Tệp khách hàng"
                      value={activeDraft.customerSegments.join(', ')}
                      onChange={(v) => updateDraft('customerSegments', splitCsv(v))}
                      hint={fields.find((f) => f.key === 'segments')}
                    />
                    <Field
                      label="Thị trường phụ trách"
                      value={activeDraft.marketsCovered.join(', ')}
                      onChange={(v) => updateDraft('marketsCovered', splitCsv(v))}
                      hint={fields.find((f) => f.key === 'markets')}
                    />
                    <Field
                      label="Ngoại ngữ (phẩy)"
                      value={activeDraft.languages.join(', ')}
                      onChange={(v) => updateDraft('languages', splitCsv(v))}
                      hint={fields.find((f) => f.key === 'languages')}
                    />
                    <Field
                      label="Vị trí mong muốn (phẩy)"
                      value={activeDraft.desiredPositions.join(', ')}
                      onChange={(v) => updateDraft('desiredPositions', splitCsv(v))}
                    />
                    <Field
                      label="Điểm mạnh / soft skills (phẩy)"
                      value={activeDraft.softSkills.join(', ')}
                      onChange={(v) => updateDraft('softSkills', splitCsv(v))}
                    />
                    <Field
                      label="Học vấn (trường)"
                      value={activeDraft.education[0]?.school ?? ''}
                      onChange={(v) =>
                        updateDraft('education', [
                          {
                            school: v,
                            degree: activeDraft.education[0]?.degree ?? '',
                            period: activeDraft.education[0]?.period ?? '',
                          },
                        ])
                      }
                      hint={fields.find((f) => f.key === 'education')}
                    />
                    <Field
                      label="Bằng cấp / chuyên ngành"
                      value={activeDraft.education[0]?.degree ?? ''}
                      onChange={(v) =>
                        updateDraft('education', [
                          {
                            school: activeDraft.education[0]?.school ?? '',
                            degree: v,
                            period: activeDraft.education[0]?.period ?? '',
                          },
                        ])
                      }
                    />
                    <Field
                      label="Chứng chỉ (phẩy)"
                      value={activeDraft.certificates.join(', ')}
                      onChange={(v) => updateDraft('certificates', splitCsv(v))}
                      hint={fields.find((f) => f.key === 'certificates')}
                    />
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600">
                      Điểm nổi bật Sales (tóm tắt)
                    </span>
                    <textarea
                      rows={2}
                      value={activeDraft.salesHighlights}
                      onChange={(e) => updateDraft('salesHighlights', e.target.value)}
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onSaveToProfile}
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Lưu vào Hồ Sơ
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
              {(saveMessage || saveError) && (
                <p
                  className={clsx(
                    'mt-3 text-xs font-medium',
                    saveError ? 'text-rose-600' : 'text-emerald-600',
                  )}
                >
                  {saveError ?? saveMessage}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="progress-card p-5">
              <h2 className="text-sm font-bold text-slate-900">Bước 3: Xem trước & tải xuống</h2>
              <p className="mt-1 text-xs text-slate-500">
                Mẫu <strong>{selected.name}</strong> đã gắn với nội dung AI của bạn. Bạn có thể lưu
                vào hồ sơ (tuỳ chọn) rồi tải CV.
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
                  onClick={onSaveToProfile}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu vào Hồ Sơ
                </button>
                <button
                  type="button"
                  onClick={onDownloadCv}
                  disabled={downloading || (!analyzed && !draft)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {downloading ? 'Đang tạo PDF…' : 'Tải xuống CV'}
                </button>
              </div>
              {(saveMessage || saveError || downloadError) && (
                <p
                  className={clsx(
                    'mt-3 text-xs font-medium',
                    saveError || downloadError ? 'text-rose-600' : 'text-emerald-600',
                  )}
                >
                  {saveError ?? downloadError ?? saveMessage}
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-3 animate-soft-rise [animation-delay:60ms]">
            <div className="progress-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
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
                  'bg-slate-100/80 p-3',
                  previewMode === 'mobile' && 'flex justify-center',
                )}
              >
                <div
                  className={clsx(
                    'overflow-hidden bg-white shadow-sm ring-1 ring-slate-200/80',
                    previewMode === 'mobile' ? 'w-[240px]' : 'w-full',
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
              <div className="space-y-2 border-t border-slate-100 p-4">
                <p className="text-center text-xs text-slate-500">
                  {analyzed ? 'Hài lòng với CV này?' : 'Phân tích AI để xem trước nội dung thật'}
                </p>
                <button
                  type="button"
                  onClick={onDownloadCv}
                  disabled={downloading || (!analyzed && !draft)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloading ? 'Đang tạo PDF…' : 'Tải xuống CV'}
                </button>
                {downloadError && (
                  <p className="text-center text-[11px] font-medium text-rose-600">{downloadError}</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-4 xl:hidden">
        <div className="progress-card p-3">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Xem trước CV</h2>
          <CvPreview draft={activeDraft} template={selected} empty={!analyzed && step === 1} />
          <button
            type="button"
            onClick={onDownloadCv}
            disabled={downloading || (!analyzed && !draft)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {downloading ? 'Đang tạo PDF…' : 'Tải xuống CV'}
          </button>
        </div>
      </div>

      {/* Bản đầy đủ ẩn — chỉ dùng để render PDF tải về */}
      <div
        className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] bg-white"
        aria-hidden
      >
        <div ref={cvPreviewRef}>
          <CvPreview
            draft={activeDraft}
            template={selected}
            empty={!analyzed && step === 1}
            exportWidth={794}
          />
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
