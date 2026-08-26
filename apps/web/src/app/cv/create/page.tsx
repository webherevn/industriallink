'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Camera,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CvDraftFieldHint, CvDraftView } from '@industriallink/contracts';
import {
  desiredPositionOptionsForTrack,
  DRIVER_LICENSE_QUESTION,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  TRAVEL_ABILITY_LABEL,
  TRAVEL_ABILITY_QUESTION,
  TravelAbility,
  composeEducationDegree,
  joinDriverLicenses,
  parseDriverLicenses,
  parseEducationDegree,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { CvApplyPositionFields } from '@/components/cv-apply-position-fields';
import { CvDraftMatrixFields } from '@/components/cv-draft-fields';
import { CvSalesExperienceFields } from '@/components/cv-sales-experience-fields';
import { CvPreview } from '@/components/cv-preview';
import { CvTechnicalFields } from '@/components/cv-technical-fields';
import { CvTechnicalExperienceFields } from '@/components/cv-technical-experience-fields';
import { CvTrackToggle } from '@/components/cv-track-toggle';
import { MatrixSection } from '@/components/matrix-section';
import { NumberedFieldLabel, NumberedTitle } from '@/components/numbered-field-label';
import { LanguageSkillsFields } from '@/components/language-skills-fields';
import { CriteriaCompletionCard } from '@/components/progress-ring';
import { MY_AVATAR_QUERY_KEY } from '@/components/profile-avatar';
import { VnAddressFields } from '@/components/vn-address-fields';
import { YearInput } from '@/components/ui';
import { toBulletText } from '@/lib/bullet-text';
import { ApiError } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { downloadElementAsPdf } from '@/lib/download-cv';
import {
  draftCvFromFile,
  draftCvFromText,
  fetchMyAvatarObjectUrl,
  getMyCandidate,
  saveCvDraftToProfile,
  uploadAvatar,
} from '@/lib/candidate';
import {
  candidateHasCvSource,
  completionPercentFromHints,
  draftFromCandidate,
  fieldHintsFromDraft,
  mergeCvDrafts,
} from '@/lib/cv-from-profile';
import {
  CV_CREATE_STEPS,
  CV_INDUSTRY_FILTERS,
  CV_TEMPLATE_FILTERS,
  CV_TEMPLATES,
  emptyCvDraft,
  emptyCvExperience,
  normalizeCvDraft,
  type CvDraft,
  type CvTemplate,
  type CvTemplateCategory,
  type CvTemplateIndustry,
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

function formatAnalyzeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại rồi thử phân tích.';
    if (err.status === 413) return 'File CV quá lớn. Hãy dùng file dưới 5MB.';
    if (err.status >= 500) {
      return err.message?.trim() || 'Máy chủ / AI tạm lỗi. Đợi vài giây rồi thử lại.';
    }
    return err.message?.trim() || `Lỗi ${err.status}`;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed')
    ) {
      return 'Mất kết nối máy chủ (có thể API đang khởi động lại). Đợi 3–5 giây rồi bấm phân tích lại.';
    }
    if (msg.trim()) return err.message;
  }
  return 'Không phân tích được. Thử lại sau.';
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh'));
    reader.readAsDataURL(file);
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('Không chuyển được ảnh'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const CV_UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export default function CreateCvPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [fields, setFields] = useState<CvDraftFieldHint[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<CvTemplateCategory>('all');
  const [industryFilter, setIndustryFilter] = useState<CvTemplateIndustry>('all');
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(CV_TEMPLATES[0].id);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<CvDraft | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<'ai' | 'profile' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  /** Ảnh CV dạng data URL — ổn định cho preview + PDF (html2canvas). */
  const [cvAvatarDataUrl, setCvAvatarDataUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarGenRef = useRef(0);
  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const fieldsCardRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading: candidateLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: avatarUrl } = useQuery({
    queryKey: MY_AVATAR_QUERY_KEY,
    queryFn: fetchMyAvatarObjectUrl,
    enabled: Boolean(candidate?.hasAvatar),
    staleTime: 5 * 60_000,
  });

  // Đồng bộ ảnh hồ sơ → data URL để PDF luôn có ảnh
  useEffect(() => {
    let cancelled = false;
    if (!avatarUrl) return;
    const gen = avatarGenRef.current;
    void urlToDataUrl(avatarUrl).then((dataUrl) => {
      if (!cancelled && dataUrl && gen === avatarGenRef.current) {
        setCvAvatarDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const displayName = candidate?.displayName ?? me?.displayName ?? 'Ứng viên';
  const selected = CV_TEMPLATES.find((t) => t.id === selectedId) ?? CV_TEMPLATES[0];
  const activeDraft = draft ?? emptyDraft(displayName, me?.email ?? '');
  const canImportFromProfile = candidateHasCvSource(candidate);
  const previewAvatarUrl = cvAvatarDataUrl;

  const templates = useMemo(() => {
    return CV_TEMPLATES.filter((t) => {
      if (filter !== 'all' && t.category !== filter) return false;
      if (industryFilter === 'all') return true;
      return t.industry === industryFilter;
    });
  }, [filter, industryFilter]);

  const industryFilterLabel =
    CV_INDUSTRY_FILTERS.find((f) => f.id === industryFilter)?.label ?? 'Theo ngành nghề';

  const liveFields = useMemo(
    () => (analyzed && draft ? fieldHintsFromDraft(draft) : fields),
    [analyzed, draft, fields],
  );
  const missingFields = liveFields.filter((f) => f.status === 'missing');
  const weakFields = liveFields.filter((f) => f.status === 'weak');
  const filledFields = liveFields.filter((f) => f.status === 'filled');
  const criteriaPercent = useMemo(
    () => completionPercentFromHints(liveFields, activeDraft.jobTrack),
    [liveFields, activeDraft.jobTrack],
  );
  const criteriaGaps = useMemo(
    () => [...missingFields, ...weakFields],
    [missingFields, weakFields],
  );

  function applyAnalyzeResult(res: Awaited<ReturnType<typeof draftCvFromText>>) {
    try {
      const aiOnly = toDraft(res.draft);
      const mergedFromProfile = Boolean(candidate && candidateHasCvSource(candidate));
      // Ghép AI (CV vừa upload) + hồ sơ nền tảng đã có → CV hoàn chỉnh hơn bản gốc
      const merged = mergedFromProfile
        ? mergeCvDrafts(aiOnly, draftFromCandidate(candidate!, me?.email ?? ''))
        : aiOnly;
      const next = {
        ...merged,
        district: null,
        salesHighlights: toBulletText(merged.salesHighlights),
      };
      setDraft(next);
      setFields(fieldHintsFromDraft(next));
      setAnalyzeMessage(
        mergedFromProfile
          ? `${res.message} Đã kết hợp thêm thông tin hồ sơ nền tảng (mục tiêu, học vấn, sở thích, Sales B2B…) để CV đầy đủ hơn bản gốc.`
          : res.message,
      );
      setAnalyzed(true);
      setImportSource('ai');
      setImportError(null);
      window.setTimeout(() => {
        fieldsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err) {
      console.error('[cv/create] applyAnalyzeResult', err);
      throw err instanceof Error
        ? err
        : new Error('Nhận được kết quả AI nhưng không hiển thị được. Thử lại.');
    }
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
    const next = { ...draftFromCandidate(candidate, me?.email ?? ''), district: null };
    setDraft(next);
    setFields(fieldHintsFromDraft(next));
    setAnalyzeMessage(
      'Đã nạp thông tin từ hồ sơ của bạn. Kiểm tra các trường bên dưới rồi tiếp tục chọn mẫu CV.',
    );
    setAnalyzed(true);
    setImportSource('profile');
    window.setTimeout(() => {
      fieldsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      // Đợi ảnh đại diện decode trước khi html2canvas chụp
      await Promise.all(
        Array.from(el.querySelectorAll('img')).map((img) =>
          img.decode().catch(() => undefined),
        ),
      );
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

  async function onPickCvAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    const gen = ++avatarGenRef.current;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (gen === avatarGenRef.current) setCvAvatarDataUrl(dataUrl);
      await uploadAvatar(file);
      await queryClient.invalidateQueries({ queryKey: ['my-candidate'] });
      await queryClient.invalidateQueries({ queryKey: MY_AVATAR_QUERY_KEY });
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Không tải được ảnh đại diện');
    } finally {
      setAvatarUploading(false);
    }
  }

  function clearUpload() {
    setUploadedName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function updateDraft<K extends keyof CvDraft>(key: K, value: CvDraft[K]) {
    setDraft((prev) => ({ ...(prev ?? activeDraft), [key]: value }));
  }

  function scrollPageTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToStep(next: number) {
    setStep(next);
    scrollPageTop();
  }

  function goToTemplates() {
    if (!draft) setDraft(activeDraft);
    goToStep(2);
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
                          PDF, DOC, DOCX hoặc TXT · tối đa 5MB. AI đọc CV rồi ghép với hồ sơ đã
                          có trên nền tảng để tạo bản CV hoàn chỉnh hơn.
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
                    {formatAnalyzeError(analyzeError)}
                  </p>
                )}
              </div>

              {analyzed && (
                <div ref={fieldsCardRef} className="progress-card space-y-4 p-5">
                  {liveFields.length > 0 && (
                    <div className="xl:hidden">
                      <CriteriaCompletionCard
                        title="Tiến độ hoàn thiện CV"
                        percent={criteriaPercent}
                        filledCount={filledFields.length}
                        totalCount={liveFields.length}
                        gaps={criteriaGaps}
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        {importSource === 'profile'
                          ? 'Thông tin từ hồ sơ'
                          : 'CV hoàn chỉnh (AI + hồ sơ nền tảng)'}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{analyzeMessage}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analyzed && liveFields.length > 0 && (
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                          Điểm AI {criteriaPercent}/100
                        </span>
                      )}
                      {importSource === 'profile' && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                          Từ hồ sơ
                        </span>
                      )}
                      {importSource === 'ai' && canImportFromProfile && (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                          Đã ghép hồ sơ
                        </span>
                      )}
                    </div>
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

                  <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="relative shrink-0">
                      <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 via-sky-500 to-amber-400 text-lg font-bold text-white shadow ring-2 ring-white">
                        {avatarUploading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-white/90" />
                        ) : previewAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewAvatarUrl}
                            alt={activeDraft.fullName || 'Ảnh CV'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (activeDraft.fullName || displayName)
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((w) => w[0])
                            .slice(-2)
                            .join('')
                            .toUpperCase() || 'UV'
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white shadow ring-2 ring-white hover:bg-brand-600 disabled:opacity-60"
                        title="Thêm / đổi ảnh đại diện CV"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          void onPickCvAvatar(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800">Ảnh đại diện trên CV</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                        Thêm ảnh để hiện trên bản xem trước và file PDF tải xuống. Ảnh cũng được lưu vào hồ sơ.
                      </p>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                      >
                        {avatarUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        {previewAvatarUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
                      </button>
                      {avatarError && (
                        <p className="mt-1 text-[11px] font-medium text-rose-600">{avatarError}</p>
                      )}
                    </div>
                  </div>

                  <MatrixSection
                    title="A. Thông tin chung (1–12)"
                    subtitle="Phần chung cho cả hồ sơ Kỹ thuật và Kinh doanh — sau đó chọn lĩnh vực bên dưới."
                  >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="1. Họ và tên"
                      value={activeDraft.fullName}
                      onChange={(v) => updateDraft('fullName', v)}
                      hint={liveFields.find((f) => f.key === 'fullName')}
                    />
                    <label className="block">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <NumberedTitle text="2. Năm sinh" />
                        <FieldStatusDot hint={liveFields.find((f) => f.key === 'birthYear')} />
                      </span>
                      <YearInput
                        className="mt-1.5"
                        value={activeDraft.birthYear != null ? String(activeDraft.birthYear) : ''}
                        onChange={(v) =>
                          updateDraft('birthYear', v.length === 4 ? Number(v) : null)
                        }
                      />
                    </label>
                    <Field
                      label="3. Số điện thoại"
                      value={activeDraft.phone}
                      onChange={(v) => updateDraft('phone', v)}
                      hint={liveFields.find((f) => f.key === 'phone')}
                    />
                    <Field
                      label="4. Email"
                      value={activeDraft.email}
                      onChange={(v) => updateDraft('email', v)}
                      hint={liveFields.find((f) => f.key === 'email')}
                    />
                  </div>

                  <div>
                    <NumberedFieldLabel
                      title="5. Nơi đang sinh sống"
                      description="Địa chỉ hành chính mới từ 01/7/2025"
                    />
                    <VnAddressFields
                      ward={activeDraft.ward ?? ''}
                      province={activeDraft.location}
                      onChange={(patch) => {
                        if (patch.ward !== undefined) updateDraft('ward', patch.ward || null);
                        if (patch.province !== undefined) updateDraft('location', patch.province);
                        // Không còn cấp huyện — luôn để trống khi chỉnh địa chỉ mới
                        updateDraft('district', null);
                      }}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <NumberedTitle text="6. Trình độ học vấn" />
                        <FieldStatusDot
                          hint={liveFields.find((f) => f.key === 'educationLevel')}
                        />
                      </span>
                      <select
                        value={activeDraft.educationLevel ?? ''}
                        onChange={(e) =>
                          updateDraft('educationLevel', e.target.value || null)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                      >
                        <option value="">— Trình độ đào tạo cao nhất —</option>
                        {EDUCATION_LEVELS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="7. Trường học"
                      value={activeDraft.education[0]?.school ?? ''}
                      onChange={(v) =>
                        updateDraft('education', [
                          {
                            school: v,
                            degree: composeEducationDegree(
                              activeDraft.educationClassification,
                              activeDraft.educationMajor,
                            ),
                            period: activeDraft.education[0]?.period ?? '',
                          },
                        ])
                      }
                      hint={liveFields.find((f) => f.key === 'education')}
                    />
                    <Field
                      label="8. Chuyên ngành"
                      value={
                        activeDraft.educationMajor ||
                        parseEducationDegree(activeDraft.education[0]?.degree).major
                      }
                      onChange={(v) => {
                        const major = v || null;
                        const classification =
                          activeDraft.educationClassification ||
                          parseEducationDegree(activeDraft.education[0]?.degree)
                            .classification ||
                          null;
                        setDraft((prev) => {
                          const base = prev ?? activeDraft;
                          return {
                            ...base,
                            educationMajor: major,
                            educationClassification: classification,
                            education: [
                              {
                                school: base.education[0]?.school ?? '',
                                degree: composeEducationDegree(classification, major),
                                period: base.education[0]?.period ?? '',
                              },
                            ],
                          };
                        });
                      }}
                    />
                    <CsvField
                      label="9. Chứng chỉ (phẩy)"
                      values={activeDraft.certificates}
                      onChange={(v) => updateDraft('certificates', v)}
                      hint={liveFields.find((f) => f.key === 'certificates')}
                    />
                  </div>

                  <div>
                    <NumberedFieldLabel
                      title="10. Ngoại ngữ"
                      extra={<FieldStatusDot hint={liveFields.find((f) => f.key === 'languages')} />}
                      description="Chọn ngôn ngữ sử dụng trong công việc và mức độ sử dụng."
                    />
                    <LanguageSkillsFields
                      languages={activeDraft.languages}
                      languageSkills={activeDraft.languageSkills ?? []}
                      onChange={({ languages, languageSkills }) => {
                        setDraft((prev) => ({
                          ...(prev ?? activeDraft),
                          languages,
                          languageSkills,
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <NumberedFieldLabel
                      title="11. Giấy phép lái xe"
                      extra={
                        <FieldStatusDot
                          hint={liveFields.find((f) => f.key === 'driversLicense')}
                        />
                      }
                      description={DRIVER_LICENSE_QUESTION}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DRIVER_LICENSE_TYPES.map((opt) => {
                        const selected = parseDriverLicenses(activeDraft.driverLicenseType);
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
                                let next: string[];
                                if (checked) {
                                  next = selected.filter((x) => x !== opt);
                                } else if (opt === 'Chưa có') {
                                  next = ['Chưa có'];
                                } else {
                                  next = [
                                    ...selected.filter((x) => x !== 'Chưa có'),
                                    opt,
                                  ];
                                }
                                setDraft((prev) => ({
                                  ...(prev ?? activeDraft),
                                  driverLicenseType: joinDriverLicenses(next),
                                  hasB2License: next.includes('Ô tô')
                                    ? true
                                    : next.length > 0
                                      ? false
                                      : null,
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <NumberedTitle text="12. Khả năng đi công tác" />
                      <FieldStatusDot hint={liveFields.find((f) => f.key === 'travel')} />
                    </span>
                    <p className="mt-0.5 mb-1.5 text-xs text-slate-500">{TRAVEL_ABILITY_QUESTION}</p>
                    <select
                      value={activeDraft.travelAbility ?? ''}
                      onChange={(e) => updateDraft('travelAbility', e.target.value || null)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
                    >
                      <option value="">— Chọn —</option>
                      {Object.values(TravelAbility).map((v) => (
                        <option key={v} value={v}>
                          {TRAVEL_ABILITY_LABEL[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                  </MatrixSection>

                  <CvTrackToggle
                    value={activeDraft.jobTrack}
                    onChange={(track) => {
                      updateDraft('jobTrack', track);
                      const nextCatalog = new Set(desiredPositionOptionsForTrack(track));
                      const prevCatalog = new Set(
                        desiredPositionOptionsForTrack(activeDraft.jobTrack),
                      );
                      const nextDesired = activeDraft.desiredPositions.filter(
                        (p) =>
                          nextCatalog.has(p) ||
                          (track === 'technical' && !prevCatalog.has(p)),
                      );
                      if (nextDesired.length !== activeDraft.desiredPositions.length) {
                        updateDraft('desiredPositions', nextDesired);
                      }
                    }}
                  />

                  {activeDraft.jobTrack === 'sales' ? (
                    <>
                      <CvDraftMatrixFields
                        draft={activeDraft}
                        fields={liveFields}
                        onChange={updateDraft}
                        lead={
                          <CvApplyPositionFields
                            draft={activeDraft}
                            onChange={updateDraft}
                            titleHint={liveFields.find((f) => f.key === 'title')}
                          />
                        }
                      />

                      <CvSalesExperienceFields
                        draft={activeDraft}
                        onChange={updateDraft}
                        hint={liveFields.find((f) => f.key === 'experience')}
                      />
                    </>
                  ) : activeDraft.jobTrack === 'technical' ? (
                    <>
                      <CvTechnicalFields
                        draft={activeDraft}
                        onChange={updateDraft}
                        lead={
                          <CvApplyPositionFields
                            draft={activeDraft}
                            onChange={updateDraft}
                            titleHint={liveFields.find((f) => f.key === 'title')}
                          />
                        }
                      />

                      <CvTechnicalExperienceFields
                        draft={activeDraft}
                        onChange={updateDraft}
                        hint={liveFields.find((f) => f.key === 'experience')}
                      />
                    </>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
                      Chọn <span className="font-semibold text-slate-700">Kinh doanh</span> ở trên
                      để hiện các mục 13–34, hoặc{' '}
                      <span className="font-semibold text-slate-700">Kỹ thuật</span> để hiện các
                      mục 13–32 theo bộ tiêu chí kỹ thuật.
                    </p>
                  )}

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
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIndustryMenuOpen((v) => !v)}
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                      industryFilter !== 'all'
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {industryFilter === 'all' ? 'Theo ngành nghề' : industryFilterLabel}
                    <ChevronDown
                      className={clsx(
                        'h-3.5 w-3.5 transition',
                        industryMenuOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {industryMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Đóng menu ngành nghề"
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setIndustryMenuOpen(false)}
                      />
                      <div className="absolute left-0 z-20 mt-1 min-w-[14rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10">
                        {CV_INDUSTRY_FILTERS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setIndustryFilter(opt.id);
                              setIndustryMenuOpen(false);
                              const first = CV_TEMPLATES.find((t) => {
                                if (filter !== 'all' && t.category !== filter) return false;
                                if (opt.id === 'all') return true;
                                return t.industry === opt.id;
                              });
                              if (first) setSelectedId(first.id);
                            }}
                            className={clsx(
                              'flex w-full px-3.5 py-2 text-left text-xs font-medium transition',
                              industryFilter === opt.id
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {templates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={tpl.id === selectedId}
                    onSelect={() => {
                      setSelectedId(tpl.id);
                      scrollPageTop();
                    }}
                  />
                ))}
              </div>
              {!templates.length && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Không có mẫu phù hợp bộ lọc. Thử đổi phong cách hoặc ngành nghề.
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
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
                    onClick={() => goToStep(3)}
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
                  onClick={() => goToStep(1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sửa nội dung
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
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
          <div className="sticky top-4 flex h-[calc(100vh-1.5rem)] flex-col gap-2 overflow-hidden animate-soft-rise [animation-delay:60ms]">
            {liveFields.length > 0 && (
              <div className="max-h-[38%] shrink-0 overflow-y-auto">
                <CriteriaCompletionCard
                  title="Tiến độ hoàn thiện CV"
                  percent={criteriaPercent}
                  filledCount={filledFields.length}
                  totalCount={liveFields.length}
                  gaps={criteriaGaps}
                  maxGaps={3}
                />
              </div>
            )}
            <div className="progress-card flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
                <h2 className="text-sm font-bold text-slate-900">Xem trước CV</h2>
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={clsx(
                      'rounded-md p-1.5',
                      previewMode === 'desktop'
                        ? 'bg-white text-brand-600 shadow-sm'
                        : 'text-slate-400',
                    )}
                    aria-label="Xem trước dạng desktop"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={clsx(
                      'rounded-md p-1.5',
                      previewMode === 'mobile'
                        ? 'bg-white text-brand-600 shadow-sm'
                        : 'text-slate-400',
                    )}
                    aria-label="Xem trước dạng mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div
                className={clsx(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/80 p-2',
                  previewMode === 'mobile' && 'flex justify-center',
                )}
              >
                <div
                  className={clsx(
                    'overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200/80',
                    previewMode === 'mobile' ? 'w-[200px]' : 'w-full',
                  )}
                  style={previewMode === 'desktop' ? { zoom: 0.78 } : undefined}
                >
                  <CvPreview
                    draft={activeDraft}
                    template={selected}
                    compact
                    empty={!analyzed && step === 1}
                    avatarUrl={previewAvatarUrl}
                  />
                </div>
              </div>
              <div className="shrink-0 space-y-1.5 border-t border-slate-100 px-3 py-2.5">
                <p className="text-center text-[11px] text-slate-500">
                  {analyzed
                    ? 'Hài lòng với CV này?'
                    : 'Phân tích AI để xem trước nội dung thật'}
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
                  <p className="text-center text-[11px] font-medium text-rose-600">
                    {downloadError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-4 xl:hidden">
        <div className="progress-card overflow-hidden p-0">
          <div className="border-b border-slate-100 px-3 py-2">
            <h2 className="text-sm font-bold text-slate-900">Xem trước CV</h2>
          </div>
          <div className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain bg-slate-100/80 p-2">
            <div
              className="overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200/80"
              style={{ zoom: 0.88 }}
            >
              <CvPreview
                draft={activeDraft}
                template={selected}
                compact
                empty={!analyzed && step === 1}
                avatarUrl={previewAvatarUrl}
              />
            </div>
          </div>
          <div className="border-t border-slate-100 p-3">
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
              <p className="mt-2 text-center text-[11px] font-medium text-rose-600">
                {downloadError}
              </p>
            )}
          </div>
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
            avatarUrl={previewAvatarUrl}
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

/** Ô danh sách cách nhau bằng phẩy — giữ dấu cách khi đang gõ. */
function CsvField({
  label,
  values,
  onChange,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: CvDraftFieldHint;
}) {
  const [text, setText] = useState(() => values.join(', '));
  const focusedRef = useRef(false);
  const valuesKey = values.join('\u0001');

  useEffect(() => {
    if (!focusedRef.current) {
      setText(values.join(', '));
    }
  }, [valuesKey, values]);

  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <NumberedTitle text={label} />
        <FieldStatusDot hint={hint} />
      </span>
      <input
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(splitCsv(next));
        }}
        onBlur={() => {
          focusedRef.current = false;
          const normalized = splitCsv(text);
          onChange(normalized);
          setText(normalized.join(', '));
        }}
        placeholder={hint?.status === 'missing' ? hint.suggestion : 'VD: ISO 9001, An toàn lao động'}
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
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <NumberedTitle text={label} />
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
        <p className="mt-0.5 text-[10px] text-slate-400">
          {template.industry === 'sales'
            ? 'Nhân viên kinh doanh'
            : template.industry === 'technical'
              ? 'Kỹ thuật'
              : template.category === 'modern'
                ? 'Hiện đại'
                : template.category === 'professional'
                  ? 'Chuyên nghiệp'
                  : template.category === 'creative'
                    ? 'Sáng tạo'
                    : 'Tối giản'}
        </p>
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
