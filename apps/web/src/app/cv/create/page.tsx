'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FileUp,
  Lightbulb,
  Loader2,
  Mail,
  Monitor,
  MoreHorizontal,
  Pencil,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
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
import { CopilotRobot } from '@/components/copilot-robot';
import { CvApplyPositionFields } from '@/components/cv-apply-position-fields';
import { CvDraftMatrixFields } from '@/components/cv-draft-fields';
import { CvSalesExperienceFields } from '@/components/cv-sales-experience-fields';
import { CvPreview } from '@/components/cv-preview';
import { CvTechnicalFields } from '@/components/cv-technical-fields';
import { CvTechnicalExperienceFields } from '@/components/cv-technical-experience-fields';
import { CvTrackToggle } from '@/components/cv-track-toggle';
import { CvFormAccordion, useCvSectionProps, useOpenCvSection } from '@/components/cv-form-accordion';
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
import { generateAiCoverLetter, saveCoverLetterForApply } from '@/lib/cover-letter';
import { listBookmarkedJobs } from '@/lib/jobs';
import { recommendedJobs } from '@/lib/matching';
import {
  candidateHasCvSource,
  completionPercentFromHints,
  draftFromCandidate,
  fieldHintsFromDraft,
  matrixCriteriaHints,
  mergeCvDrafts,
} from '@/lib/cv-from-profile';
import { criteriaAnchorId, criteriaPlace, scrollToCriteria } from '@/lib/criteria-jump';
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

const SAVED_CV_STORAGE_KEY = 'inlink_saved_cvs_v1';

interface SavedCvRecord {
  id: string;
  fileName: string;
  updatedAt: string;
  templateId: string;
  isDefault?: boolean;
}

const CV_TIPS = [
  {
    id: 'cv-attracting',
    title: 'Cách viết CV thu hút nhà tuyển dụng',
    summary:
      'Ưu tiên đưa con số thực tế (doanh số, % KPI, quy mô dự án, số năm kinh nghiệm ngành công nghiệp) lên 3 dòng đầu tiên của mỗi công ty.',
    bullets: [
      'Ghi rõ nhóm sản phẩm / thiết bị kỹ thuật từng phụ trách (VD: máy nén khí, biến tần, hệ thống HVAC).',
      'Nêu rõ tệp khách hàng mục tiêu (nhà máy FDI, khu công nghiệp, nhà thầu M&E) để khớp bộ lọc B2B.',
      'Giữ độ dài CV gọn trong 1–2 trang A4 với các gạch đầu dòng súc tích.',
    ],
  },
  {
    id: 'cover-letter-tips',
    title: 'Mẹo viết thư xin việc ấn tượng',
    summary:
      'Mở đầu bằng đúng tên vị trí và lý do bạn phù hợp với ngành hàng của doanh nghiệp, tránh dùng mẫu chung chung.',
    bullets: [
      'Chọn 1–2 thành tích nổi bật nhất liên quan trực tiếp đến vị trí ứng tuyển.',
      'Nhấn mạnh sự am hiểu thị trường khu vực hoặc thiết bị chuyên ngành của công ty.',
      'Kết thúc bằng lời đề nghị trao đổi cụ thể và thông tin liên hệ rõ ràng.',
    ],
  },
  {
    id: 'cv-common-mistakes',
    title: 'Những lỗi thường gặp khi tạo CV',
    summary:
      'Thiếu thông tin ngành nghề, mô tả công việc chung chung không có kết quả đo lường là nguyên nhân hàng đầu khiến hồ sơ bị giảm điểm.',
    bullets: [
      'Không liệt kê tên công ty hoặc giai đoạn làm việc cụ thể.',
      'Dùng quá nhiều từ ngữ hoa mỹ nhưng thiếu kỹ năng/công cụ thực tế.',
      'Quên kiểm tra số điện thoại, email và khu vực mong muốn làm việc.',
    ],
  },
] as const;

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
const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_FILE_EXT = new Set(['pdf', 'doc', 'docx', 'txt']);

function cvFileReject(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!CV_FILE_EXT.has(ext)) return 'Chỉ nhận file PDF, DOC, DOCX hoặc TXT.';
  if (file.size > CV_MAX_BYTES) return 'File CV quá lớn. Hãy dùng file dưới 5MB.';
  return null;
}

export default function CreateCvPage() {
  return (
    <CvFormAccordion>
      <CreateCvEditor />
    </CvFormAccordion>
  );
}

function CreateCvEditor() {
  const queryClient = useQueryClient();
  const sectionA = useCvSectionProps('A');
  const revealSection = useOpenCvSection();
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState('');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [fileHint, setFileHint] = useState<string | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [fields, setFields] = useState<CvDraftFieldHint[]>([]);
  const [analyzeMessage, setAnalyzeMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<CvTemplateCategory>('all');
  const [industryFilter, setIndustryFilter] = useState<CvTemplateIndustry>('all');
  const [industryMenuOpen, setIndustryMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(CV_TEMPLATES[0].id);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<CvDraft | null>(null);
  const [jump, setJump] = useState<{ key: string; n: number } | null>(null);
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
  const [mainTab, setMainTab] = useState<'cv' | 'cover_letter'>('cv');
  const [sourceOption, setSourceOption] = useState<'profile' | 'upload' | 'manual'>('profile');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [savedCvs, setSavedCvs] = useState<SavedCvRecord[]>([]);
  const [manageCvsOpen, setManageCvsOpen] = useState(false);
  const [openCvMenuId, setOpenCvMenuId] = useState<string | null>(null);
  const [activeTipId, setActiveTipId] = useState<string | null>(null);
  const [tipsModalOpen, setTipsModalOpen] = useState(false);
  const [coverRole, setCoverRole] = useState('');
  const [coverCompany, setCoverCompany] = useState('');
  const [coverJobId, setCoverJobId] = useState('');
  const [coverTone, setCoverTone] = useState<'pro' | 'enthusiastic' | 'concise'>('pro');
  const [coverFocus, setCoverFocus] = useState<'balanced' | 'sales_kpi' | 'technical'>('balanced');
  const [coverBody, setCoverBody] = useState('');
  const [coverViewMode, setCoverViewMode] = useState<'edit' | 'preview'>('edit');
  const [coverCopied, setCoverCopied] = useState(false);
  const [coverSavedForApply, setCoverSavedForApply] = useState(false);
  const [coverUsedAi, setCoverUsedAi] = useState<boolean | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverExporting, setCoverExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarGenRef = useRef(0);
  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const coverLetterRef = useRef<HTMLDivElement>(null);
  const fieldsCardRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading: candidateLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: aiRecommendedJobs } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: recommendedJobs,
    retry: false,
  });
  const { data: savedBookmarkedJobs } = useQuery({
    queryKey: ['job-bookmarks'],
    queryFn: listBookmarkedJobs,
    retry: false,
  });

  const targetJobOptions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; companyName: string; tag: string }>();
    for (const j of aiRecommendedJobs ?? []) {
      map.set(j.jobId, {
        id: j.jobId,
        title: j.title,
        companyName: j.companyName,
        tag: 'AI gợi ý',
      });
    }
    for (const j of savedBookmarkedJobs ?? []) {
      if (!map.has(j.id)) {
        map.set(j.id, {
          id: j.id,
          title: j.title,
          companyName: j.companyName,
          tag: 'Đã lưu',
        });
      }
    }
    return [...map.values()];
  }, [aiRecommendedJobs, savedBookmarkedJobs]);
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
  const carouselTemplate = CV_TEMPLATES[carouselIndex % CV_TEMPLATES.length] ?? CV_TEMPLATES[0];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_CV_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedCvRecord[];
        if (Array.isArray(parsed)) setSavedCvs(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!openCvMenuId) return;
    const close = () => setOpenCvMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openCvMenuId]);

  const profileCvRecord = useMemo<SavedCvRecord | null>(() => {
    if (!candidate) return null;
    const safeTitle = (candidate.profile?.currentPosition || displayName || 'HoSo')
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 28);
    return {
      id: 'profile-default',
      fileName: `CV_${safeTitle || 'Inlink'}.pdf`,
      updatedAt: 'Từ hồ sơ Inlink',
      templateId: selectedId,
      isDefault: true,
    };
  }, [candidate, displayName, selectedId]);

  const myCvList = useMemo(() => {
    const list: SavedCvRecord[] = [];
    if (profileCvRecord) list.push(profileCvRecord);
    for (const item of savedCvs) {
      if (!list.some((x) => x.id === item.id)) list.push(item);
    }
    return list;
  }, [profileCvRecord, savedCvs]);

  function recordSavedCv(fileName: string, templateId: string) {
    const entry: SavedCvRecord = {
      id: `${Date.now()}`,
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      updatedAt: new Date().toLocaleDateString('vi-VN'),
      templateId,
    };
    setSavedCvs((prev) => {
      const next = [entry, ...prev.filter((x) => x.fileName !== entry.fileName)].slice(0, 5);
      try {
        window.localStorage.setItem(SAVED_CV_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  function removeSavedCv(id: string) {
    setSavedCvs((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try {
        window.localStorage.setItem(SAVED_CV_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  function buildCoverLetterText() {
    const role = coverRole.trim() || candidate?.profile?.currentPosition || 'Vị trí ứng tuyển';
    const company = coverCompany.trim() || 'Quý Công ty';
    const expYears = candidate?.profile?.totalExperienceYears;
    const topExp = candidate?.experiences?.[0];
    const topSkills = (candidate?.skills ?? []).slice(0, 4).map((s) => s.name).join(', ');
    const industry = candidate?.profile?.industry?.split('/')[0]?.trim() || 'công nghiệp B2B';
    const phone = candidate?.profile?.phone || '';
    const email = me?.email || '';

    if (coverTone === 'concise') {
      return [
        `Kính gửi Bộ phận Tuyển dụng ${company},`,
        '',
        `Tôi là ${displayName}, ứng tuyển vị trí ${role}. Tôi có ${expYears ? `${expYears}+ năm` : 'kinh nghiệm'} làm việc trong lĩnh vực ${industry}${topExp ? `, gần nhất đảm nhiệm ${topExp.jobTitle} tại ${topExp.companyName}` : ''}.`,
        topSkills ? `Thế mạnh cốt lõi: ${topSkills}.` : '',
        '',
        `Rất mong có cơ hội trao đổi thêm với ${company} về cách tôi có thể đóng góp vào mục tiêu sắp tới của đội ngũ.`,
        '',
        `Trân trọng,`,
        `${displayName}`,
        [phone, email].filter(Boolean).join(' · '),
      ]
        .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
        .join('\n');
    }

    if (coverTone === 'enthusiastic') {
      return [
        `Kính gửi Anh/Chị Phụ trách Tuyển dụng – ${company},`,
        '',
        `Tôi rất hào hứng khi nộp hồ sơ ứng tuyển vị trí ${role} tại ${company}. Với nền tảng thực chiến trong ngành ${industry}${expYears ? ` cùng hơn ${expYears} năm kinh nghiệm` : ''}, tôi tin mình có thể nhanh chóng hòa nhập và tạo giá trị rõ rệt ngay từ giai đoạn đầu.`,
        topExp
          ? `Tại ${topExp.companyName} (${topExp.jobTitle}), tôi đã rèn luyện năng lực triển khai công việc thực tế, bám sát mục tiêu và phối hợp chặt chẽ cùng khách hàng/đội ngũ kỹ thuật.`
          : '',
        topSkills ? `Các kỹ năng nổi bật của tôi gồm: ${topSkills}.` : '',
        '',
        `Rất mong nhận được phản hồi và cơ hội phỏng vấn trực tiếp cùng ${company}.`,
        '',
        `Trân trọng cảm ơn,`,
        `${displayName}`,
        [phone, email].filter(Boolean).join(' · '),
      ]
        .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
        .join('\n');
    }

    return [
      `Kính gửi Quý Ban Giám đốc và Bộ phận Tuyển dụng ${company},`,
      '',
      `Thông qua nền tảng Inlink, tôi được biết ${company} đang tìm kiếm nhân sự cho vị trí ${role}. Tôi viết thư này để bày tỏ nguyện vọng ứng tuyển vào vị trí trên.`,
      `Với ${expYears ? `${expYears} năm` : 'nền tảng'} kinh nghiệm chuyên sâu trong lĩnh vực ${industry}${topExp ? `, đặc biệt trong vai trò ${topExp.jobTitle} tại ${topExp.companyName}` : ''}, tôi tự tin có thể đáp ứng tốt các yêu cầu chuyên môn của ${company}.`,
      topSkills ? `Các năng lực chuyên môn nổi bật của tôi bao gồm: ${topSkills}.` : '',
      '',
      `Tôi rất mong có cơ hội được tham gia buổi phỏng vấn để trao đổi chi tiết hơn về kinh nghiệm và định hướng đóng góp cho ${company}.`,
      '',
      `Trân trọng,`,
      `${displayName}`,
      [phone, email].filter(Boolean).join(' · '),
    ]
      .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
      .join('\n');
  }

  const coverGenerateMutation = useMutation({
    mutationFn: () =>
      generateAiCoverLetter({
        jobId: coverJobId || undefined,
        targetRole: coverRole.trim() || undefined,
        targetCompany: coverCompany.trim() || undefined,
        tone: coverTone,
        focus: coverFocus,
      }),
    onSuccess: (res) => {
      setCoverError(null);
      setCoverBody(res.content);
      setCoverUsedAi(res.usedAi);
      setCoverSavedForApply(false);
    },
    onError: (err) => {
      setCoverError(err instanceof ApiError ? err.message : 'Không tạo được thư xin việc lúc này.');
      if (!coverBody.trim()) {
        setCoverBody(buildCoverLetterText());
      }
    },
  });

  async function onDownloadCoverLetterPdf() {
    if (!coverLetterRef.current || !coverBody.trim() || coverExporting) return;
    setCoverExporting(true);
    try {
      await downloadElementAsPdf(coverLetterRef.current, `Thu-xin-viec-${displayName}`);
    } finally {
      setCoverExporting(false);
    }
  }

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
  const criteriaHints = useMemo(
    () => matrixCriteriaHints(liveFields, activeDraft.jobTrack),
    [liveFields, activeDraft.jobTrack],
  );
  const missingFields = criteriaHints.filter((f) => f.status === 'missing');
  const weakFields = criteriaHints.filter((f) => f.status === 'weak');
  const filledFields = criteriaHints.filter((f) => f.status === 'filled');
  const criteriaPercent = useMemo(
    () => completionPercentFromHints(criteriaHints, activeDraft.jobTrack),
    [criteriaHints, activeDraft.jobTrack],
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
      recordSavedCv(`CV-${name}.pdf`, selected.id);
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
    const reason = cvFileReject(file);
    if (reason) {
      setFileHint(reason);
      return;
    }
    setFileHint(null);
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
    setFileHint(null);
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

  function jumpToGap(gap: CvDraftFieldHint) {
    const place = criteriaPlace(gap.key, activeDraft.jobTrack);
    if (step !== 1) setStep(1);
    if (!activeDraft.jobTrack && place.cvSection !== 'A') {
      scrollToCriteria('jobTrack');
      return;
    }
    revealSection(place.cvSection);
    setJump({ key: gap.key, n: Date.now() });
    scrollToCriteria(gap.key);
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
            <h1 className="text-2xl font-extrabold tracking-tight text-[#072348] sm:text-[26px]">
              CV &amp; Thư xin việc
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Tạo CV chuyên nghiệp và thư xin việc ấn tượng với AI, dựa trên hồ sơ và mục tiêu công việc của bạn.
            </p>
          </div>

          {/* 2 Tabs chính: Tạo CV bằng AI | Tạo Thư xin việc bằng AI */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMainTab('cv')}
              className={clsx(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition sm:text-sm',
                mainTab === 'cv'
                  ? 'bg-[#072348] text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Tạo CV bằng AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMainTab('cover_letter');
                if (!coverBody.trim()) {
                  setCoverBody(buildCoverLetterText());
                }
              }}
              className={clsx(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition sm:text-sm',
                mainTab === 'cover_letter'
                  ? 'bg-[#072348] text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span>Tạo Thư xin việc bằng AI</span>
            </button>
          </div>

          {mainTab === 'cover_letter' ? (
            <div className="space-y-4 rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#072348]">
                    Tạo Thư xin việc bằng AI từ hồ sơ
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    AI cá nhân hóa nội dung thư theo tin tuyển dụng mục tiêu, số liệu thành tích và kỹ năng thực tế của bạn.
                  </p>
                </div>
                {coverUsedAi !== null && (
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-sky-200/70">
                    {coverUsedAi ? '✨ Đã tối ưu bằng Gemini AI' : 'Đã dựng từ hồ sơ Inlink'}
                  </span>
                )}
              </div>

              {targetJobOptions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn tin tuyển dụng trên Inlink (tùy chọn — AI bám sát yêu cầu JD)
                  </label>
                  <select
                    value={coverJobId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setCoverJobId(nextId);
                      const picked = targetJobOptions.find((j) => j.id === nextId);
                      if (picked) {
                        setCoverRole(picked.title);
                        setCoverCompany(picked.companyName);
                      }
                    }}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">-- Nhập thủ công vị trí &amp; công ty bên dưới --</option>
                    {targetJobOptions.map((j) => (
                      <option key={j.id} value={j.id}>
                        [{j.tag}] {j.title} — {j.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Vị trí ứng tuyển
                  </label>
                  <input
                    type="text"
                    value={coverRole}
                    onChange={(e) => setCoverRole(e.target.value)}
                    placeholder={candidate?.profile?.currentPosition || 'VD: Nhân viên Kinh doanh B2B'}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tên công ty mục tiêu
                  </label>
                  <input
                    type="text"
                    value={coverCompany}
                    onChange={(e) => setCoverCompany(e.target.value)}
                    placeholder="VD: Công ty CP Thiết bị Khí nén Hà Nội"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-semibold text-slate-600">Giọng văn:</span>
                    {(
                      [
                        { id: 'pro', label: 'Chuyên nghiệp B2B' },
                        { id: 'enthusiastic', label: 'Nhiệt huyết' },
                        { id: 'concise', label: 'Ngắn gọn' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCoverTone(t.id)}
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold transition',
                          coverTone === t.id
                            ? 'bg-[#072348] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={coverGenerateMutation.isPending}
                    onClick={() => coverGenerateMutation.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-brand-600 disabled:opacity-60"
                  >
                    {coverGenerateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {coverGenerateMutation.isPending
                        ? 'AI đang viết thư...'
                        : coverBody.trim()
                          ? 'Viết lại bằng AI'
                          : 'Tạo bằng AI'}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-semibold text-slate-600">Điểm nhấn:</span>
                    {(
                      [
                        { id: 'balanced', label: 'Cân bằng' },
                        { id: 'sales_kpi', label: 'Doanh số & KPI' },
                        { id: 'technical', label: 'Kỹ thuật & Dự án' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCoverFocus(f.id)}
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold transition',
                          coverFocus === f.id
                            ? 'bg-sky-50 text-brand-700 ring-1 ring-brand-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCoverViewMode('edit')}
                      className={clsx(
                        'rounded-md px-2.5 py-1 transition',
                        coverViewMode === 'edit'
                          ? 'bg-white text-[#072348] shadow-2xs'
                          : 'text-slate-500',
                      )}
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverViewMode('preview')}
                      className={clsx(
                        'rounded-md px-2.5 py-1 transition',
                        coverViewMode === 'preview'
                          ? 'bg-white text-[#072348] shadow-2xs'
                          : 'text-slate-500',
                      )}
                    >
                      Xem trước A4
                    </button>
                  </div>
                </div>
              </div>

              {coverError && (
                <p className="text-xs font-medium text-amber-700">
                  {coverError} (Đã tự động dựng bản thư dự phòng từ hồ sơ của bạn)
                </p>
              )}

              {coverViewMode === 'preview' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                  <div className="mx-auto max-w-[640px] rounded-lg border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
                    <div className="border-b-2 border-[#072348] pb-3">
                      <p className="text-base font-extrabold text-[#072348]">{displayName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[candidate?.profile?.phone, me?.email, candidate?.profile?.currentCity]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#072348]">
                      Thư ứng tuyển{coverRole.trim() ? ` — ${coverRole.trim()}` : ''}
                    </p>
                    <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {coverBody || 'Chưa có nội dung thư. Bấm «Tạo bằng AI» để AI viết thư cho bạn.'}
                    </div>
                  </div>
                </div>
              ) : (
                <textarea
                  value={coverBody}
                  onChange={(e) => {
                    setCoverBody(e.target.value);
                    setCoverSavedForApply(false);
                  }}
                  spellCheck={false}
                  rows={12}
                  placeholder="Bấm «Tạo bằng AI» để AI viết thư xin việc chuẩn B2B từ hồ sơ của bạn..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/40 p-4 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-500 focus:bg-white"
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!coverBody.trim()}
                  onClick={() => {
                    saveCoverLetterForApply(coverBody, coverJobId || null);
                    setCoverSavedForApply(true);
                  }}
                  className={clsx(
                    'inline-flex h-10 items-center gap-1.5 rounded-xl border px-4 text-xs font-semibold transition disabled:opacity-50',
                    coverSavedForApply
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-brand-200 bg-sky-50/70 text-brand-700 hover:bg-sky-100',
                  )}
                >
                  {coverSavedForApply ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {coverSavedForApply ? 'Đã lưu dùng khi ứng tuyển' : 'Lưu dùng khi ứng tuyển'}
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!coverBody.trim()}
                    onClick={async () => {
                      await navigator.clipboard.writeText(coverBody);
                      setCoverCopied(true);
                      window.setTimeout(() => setCoverCopied(false), 2000);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {coverCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{coverCopied ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!coverBody.trim() || coverExporting}
                    onClick={onDownloadCoverLetterPdf}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#072348] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3468] disabled:opacity-50"
                  >
                    {coverExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    <span>{coverExporting ? 'Đang xuất PDF...' : 'Tải PDF Thư xin việc'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Stepper current={step} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs sm:p-6">
                <div>
                  <h2 className="text-base font-bold text-[#072348]">
                    Bước 1: Chọn nguồn dữ liệu
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Sử dụng thông tin có sẵn hoặc tải lên CV để tạo CV mới bằng AI.
                  </p>
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

                {/* 3 tùy chọn nguồn dữ liệu dạng Radio Card */}
                <div className="mt-4 space-y-2.5">
                  {/* Lựa chọn 1: Từ hồ sơ của tôi */}
                  <button
                    type="button"
                    onClick={() => setSourceOption('profile')}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition',
                      sourceOption === 'profile'
                        ? 'border-[#072348] bg-[#F8FBFF] ring-1 ring-[#072348]/15'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          sourceOption === 'profile'
                            ? 'border-[#072348]'
                            : 'border-slate-300',
                        )}
                      >
                        {sourceOption === 'profile' ? (
                          <span className="h-2 w-2 rounded-full bg-[#072348]" />
                        ) : null}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#072348]">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#072348]">Từ hồ sơ của tôi</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Tự động lấy thông tin cá nhân, kinh nghiệm, học vấn, kỹ năng đã cập nhật.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                      Khuyên dùng
                    </span>
                  </button>

                  {/* Lựa chọn 2: Tải lên CV hiện có */}
                  <div
                    className={clsx(
                      'rounded-xl border transition',
                      sourceOption === 'upload'
                        ? 'border-[#072348] bg-[#F8FBFF] ring-1 ring-[#072348]/15'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSourceOption('upload')}
                      className="flex w-full items-center gap-3 p-3.5 text-left"
                    >
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          sourceOption === 'upload'
                            ? 'border-[#072348]'
                            : 'border-slate-300',
                        )}
                      >
                        {sourceOption === 'upload' ? (
                          <span className="h-2 w-2 rounded-full bg-[#072348]" />
                        ) : null}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#072348]">
                        <FileUp className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#072348]">Tải lên CV hiện có</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          AI sẽ phân tích và tối ưu nội dung CV của bạn (PDF, DOC, DOCX, TXT · tối đa 5MB).
                        </p>
                      </div>
                    </button>

                    {sourceOption === 'upload' && (
                      <div
                        onDragEnter={(event) => {
                          event.preventDefault();
                          if (!analyzing) setFileOver(true);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (!analyzing) setFileOver(true);
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault();
                          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                          setFileOver(false);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setFileOver(false);
                          onPickFile(event.dataTransfer.files?.[0]);
                        }}
                        className={clsx(
                          'mx-3.5 mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 transition',
                          fileOver
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-brand-200 bg-white',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-600">
                            {uploadedName
                              ? `Đã chọn: ${uploadedName}`
                              : 'Kéo thả file CV vào đây hoặc bấm nút chọn file'}
                          </p>
                          {fileHint && <p className="mt-1 text-xs text-rose-600">{fileHint}</p>}
                          {analyzeError && (
                            <p className="mt-1 text-xs text-rose-600">
                              {formatAnalyzeError(analyzeError)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {uploadedName && !uploadMutation.isPending && (
                            <button
                              type="button"
                              onClick={clearUpload}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              Xóa
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={analyzing}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 disabled:opacity-50"
                          >
                            {uploadMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            <span>{uploadMutation.isPending ? 'Đang phân tích…' : 'Chọn file CV'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lựa chọn 3: Nhập thông tin thủ công */}
                  <div
                    className={clsx(
                      'rounded-xl border transition',
                      sourceOption === 'manual'
                        ? 'border-[#072348] bg-[#F8FBFF] ring-1 ring-[#072348]/15'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSourceOption('manual')}
                      className="flex w-full items-center gap-3 p-3.5 text-left"
                    >
                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          sourceOption === 'manual'
                            ? 'border-[#072348]'
                            : 'border-slate-300',
                        )}
                      >
                        {sourceOption === 'manual' ? (
                          <span className="h-2 w-2 rounded-full bg-[#072348]" />
                        ) : null}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#072348]">
                        <Pencil className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#072348]">Nhập thông tin thủ công</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Tạo CV mới với thông tin do bạn cung cấp hoặc mô tả nhanh để AI trích xuất.
                        </p>
                      </div>
                    </button>

                    {sourceOption === 'manual' && (
                      <div className="mx-3.5 mb-3.5 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-600">
                            Mô tả nhanh bản thân (hoặc bấm Tiếp tục để tự điền từng mục)
                          </span>
                          <button
                            type="button"
                            onClick={() => setRawText(SAMPLE_PROMPT)}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Dùng ví dụ mẫu
                          </button>
                        </div>
                        <textarea
                          value={rawText}
                          onChange={(e) => setRawText(e.target.value)}
                          rows={5}
                          disabled={analyzing}
                          placeholder="Ví dụ: Tôi tên …, làm kỹ sư PLC 5 năm tại … Email … Thành thạo …"
                          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs leading-relaxed text-slate-800 outline-none focus:border-brand-500 focus:bg-white disabled:opacity-60"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-slate-400">
                            Tối thiểu ~40 ký tự · {rawText.trim().length} ký tự hiện tại
                          </p>
                          <button
                            type="button"
                            onClick={onAnalyze}
                            disabled={rawText.trim().length < 40 || analyzing}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-brand-600 disabled:opacity-50"
                          >
                            {analyzeMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5" />
                            )}
                            <span>{analyzeMutation.isPending ? 'Đang phân tích…' : 'Phân tích bằng AI'}</span>
                          </button>
                        </div>
                        {analyzeError && (
                          <p className="text-xs text-rose-600">{formatAnalyzeError(analyzeError)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hộp AI sẽ giúp bạn + Robot Copilot */}
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-gradient-to-r from-[#F3F8FF] to-[#EAF2FF] px-4 py-3.5">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#072348]">
                      <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                      <span>AI sẽ giúp bạn</span>
                    </p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>Tối ưu nội dung, làm nổi bật kinh nghiệm và kỹ năng.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>Gợi ý cách diễn đạt chuyên nghiệp, phù hợp vị trí ứng tuyển.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>Đảm bảo bố cục rõ ràng, dễ đọc, chuẩn nhà tuyển dụng.</span>
                      </li>
                    </ul>
                  </div>
                  <div className="hidden w-24 shrink-0 sm:block" aria-hidden>
                    <CopilotRobot />
                  </div>
                </div>

                {importError && <p className="mt-3 text-xs font-medium text-rose-600">{importError}</p>}

                {/* Nút Tiếp tục */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={candidateLoading || analyzing}
                    onClick={() => {
                      if (sourceOption === 'profile') {
                        if (!analyzed || importSource !== 'profile') {
                          importFromProfile();
                        }
                        if (canImportFromProfile) goToStep(2);
                        return;
                      }
                      if (sourceOption === 'upload') {
                        if (analyzed && draft) {
                          goToStep(2);
                        } else {
                          fileInputRef.current?.click();
                        }
                        return;
                      }
                      if (!draft) setDraft(emptyDraft(displayName, me?.email ?? ''));
                      setAnalyzed(true);
                      goToStep(2);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#072348] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3468] disabled:opacity-50"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {analyzed && (
                <div ref={fieldsCardRef} className="progress-card cv-create-form space-y-4 p-5">
                  {criteriaHints.length > 0 && (
                    <div className="xl:hidden">
                      <CriteriaCompletionCard
                        title="Tiến độ hoàn thiện CV"
                        percent={criteriaPercent}
                        filledCount={filledFields.length}
                        totalCount={criteriaHints.length}
                        gaps={criteriaGaps}
                        onGapClick={jumpToGap}
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
                      {analyzed && criteriaHints.length > 0 && (
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                          Hoàn thành {criteriaPercent}/100
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
                            <button
                              type="button"
                              onClick={() => jumpToGap(f)}
                              className="text-left hover:underline"
                            >
                              <span className="font-semibold text-brand-800">{f.label}</span>
                              <span className="text-amber-700"> — {f.suggestion}</span>
                            </button>
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
                    {...sectionA}
                  >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      anchor={criteriaAnchorId('fullName')}
                      label="1. Họ và tên"
                      value={activeDraft.fullName}
                      onChange={(v) => updateDraft('fullName', v)}
                      hint={liveFields.find((f) => f.key === 'fullName')}
                    />
                    <label id={criteriaAnchorId('birthYear')} className="block scroll-mt-28">
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
                      anchor={criteriaAnchorId('phone')}
                      label="3. Số điện thoại"
                      value={activeDraft.phone}
                      onChange={(v) => updateDraft('phone', v)}
                      hint={liveFields.find((f) => f.key === 'phone')}
                    />
                    <Field
                      anchor={criteriaAnchorId('email')}
                      label="4. Email"
                      value={activeDraft.email}
                      onChange={(v) => updateDraft('email', v)}
                      hint={liveFields.find((f) => f.key === 'email')}
                    />
                  </div>

                  <div id={criteriaAnchorId('location')} className="scroll-mt-28">
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
                    <label id={criteriaAnchorId('educationLevel')} className="block scroll-mt-28">
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
                      anchor={criteriaAnchorId('education')}
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
                      anchor={criteriaAnchorId('educationMajor')}
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
                      anchor={criteriaAnchorId('certificates')}
                      label="9. Chứng chỉ (phẩy)"
                      values={activeDraft.certificates}
                      onChange={(v) => updateDraft('certificates', v)}
                      hint={liveFields.find((f) => f.key === 'certificates')}
                    />
                  </div>

                  <div id={criteriaAnchorId('languages')} className="scroll-mt-28">
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

                  <div id={criteriaAnchorId('driversLicense')} className="scroll-mt-28">
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

                  <label id={criteriaAnchorId('travel')} className="block scroll-mt-28">
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

                  <div id={criteriaAnchorId('jobTrack')} className="scroll-mt-28">
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
                  </div>

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
                            titleHint={liveFields.find((f) => f.key === 'desiredPositions')}
                          />
                        }
                      />

                      <CvSalesExperienceFields
                        draft={activeDraft}
                        onChange={updateDraft}
                        hint={liveFields.find((f) => f.key === 'experience')}
                        jump={jump}
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
                            titleHint={liveFields.find((f) => f.key === 'desiredPositions')}
                          />
                        }
                      />

                      <CvTechnicalExperienceFields
                        jump={jump}
                        draft={activeDraft}
                        onChange={updateDraft}
                        hint={liveFields.find((f) => f.key === 'experience')}
                      />
                    </>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
                      Chọn <span className="font-semibold text-slate-700">Kinh doanh</span> ở trên
                      để hiện các mục 13–32, hoặc{' '}
                      <span className="font-semibold text-slate-700">Kỹ thuật</span> để hiện các
                      mục 13–28 theo bộ tiêu chí kỹ thuật.
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
            </>
          )}
        </section>

        {/* Cột phải: CV của tôi, Xem trước mẫu CV, Mẹo & hướng dẫn */}
        <aside className="space-y-4">
          {/* 1. CV của tôi */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#072348]">
                CV của tôi ({myCvList.length})
              </h2>
              <button
                type="button"
                onClick={() => setManageCvsOpen(true)}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <span>Quản lý CV</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {myCvList.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                Chưa có bản CV nào. Tạo từ hồ sơ để xuất PDF nhanh.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {myCvList.slice(0, 3).map((cvItem) => {
                  const menuOpen = openCvMenuId === cvItem.id;
                  return (
                    <li
                      key={cvItem.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-brand-600">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#072348]" title={cvItem.fileName}>
                            {cvItem.fileName}
                          </p>
                          <p className="mt-0.5 truncate text-[10.5px] text-slate-500">
                            {cvItem.updatedAt}
                          </p>
                        </div>
                      </div>

                      <div className="relative flex shrink-0 items-center gap-1.5">
                        {cvItem.isDefault && (
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-sky-200/70">
                            Mặc định
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Tùy chọn CV"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenCvMenuId((prev) => (prev === cvItem.id ? null : cvItem.id));
                          }}
                          className="rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {menuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenCvMenuId(null);
                                if (cvItem.isDefault && candidate && !draft) {
                                  importFromProfile();
                                }
                                setSelectedId(cvItem.templateId || CV_TEMPLATES[0].id);
                                window.setTimeout(() => {
                                  void onDownloadCv();
                                }, 60);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5 text-brand-600" />
                              <span>Tải xuống PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenCvMenuId(null);
                                setMainTab('cv');
                                if (candidate) importFromProfile();
                                goToStep(2);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              <span>Mở chỉnh sửa</span>
                            </button>
                            {!cvItem.isDefault && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCvMenuId(null);
                                  removeSavedCv(cvItem.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Xóa khỏi lịch sử</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 2. Xem trước mẫu CV (hoặc Xem trước CV đang sửa ở Bước 2-3) */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#072348]">
                {step >= 2 || analyzed ? 'Xem trước CV' : 'Xem trước mẫu CV'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMainTab('cv');
                  goToTemplates();
                }}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <span>Xem tất cả mẫu</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative mt-3 flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Mẫu trước"
                onClick={() =>
                  setCarouselIndex((i) => (i - 1 + CV_TEMPLATES.length) % CV_TEMPLATES.length)
                }
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-1.5">
                <div
                  className="overflow-hidden rounded-lg bg-white shadow-2xs"
                  style={{ zoom: 0.45 }}
                >
                  <CvPreview
                    draft={activeDraft}
                    template={step >= 2 ? selected : carouselTemplate}
                    compact
                    empty={!analyzed && !canImportFromProfile}
                    avatarUrl={previewAvatarUrl}
                  />
                </div>
              </div>

              <button
                type="button"
                aria-label="Mẫu tiếp theo"
                onClick={() => setCarouselIndex((i) => (i + 1) % CV_TEMPLATES.length)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-2xs transition hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              {CV_TEMPLATES.slice(0, 5).map((tpl, idx) => (
                <button
                  key={tpl.id}
                  type="button"
                  aria-label={`Chọn ${tpl.name}`}
                  onClick={() => setCarouselIndex(idx)}
                  className={clsx(
                    'h-1.5 rounded-full transition-all',
                    carouselIndex % CV_TEMPLATES.length === idx
                      ? 'w-4 bg-[#072348]'
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400',
                  )}
                />
              ))}
            </div>

            {(analyzed || draft) && (
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onDownloadCv}
                  disabled={downloading || (!analyzed && !draft)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  {downloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{downloading ? 'Đang tạo PDF…' : 'Tải xuống CV'}</span>
                </button>
                {downloadError && (
                  <p className="text-center text-[11px] font-medium text-rose-600">
                    {downloadError}
                  </p>
                )}
              </div>
            )}
          </div>

          {criteriaHints.length > 0 && analyzed && (
            <CriteriaCompletionCard
              title="Tiến độ hoàn thiện CV"
              percent={criteriaPercent}
              filledCount={filledFields.length}
              totalCount={criteriaHints.length}
              gaps={criteriaGaps}
              maxGaps={3}
              onGapClick={jumpToGap}
            />
          )}

          {/* 3. Mẹo & hướng dẫn */}
          <div className="rounded-2xl border border-[#dce6f4] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-[#072348]">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span>Mẹo &amp; hướng dẫn</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setActiveTipId(null);
                  setTipsModalOpen(true);
                }}
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {CV_TIPS.map((tip) => (
                <li key={tip.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTipId(tip.id);
                      setTipsModalOpen(true);
                    }}
                    className="flex w-full items-start gap-2 rounded-lg p-1 text-left text-xs text-slate-600 transition hover:bg-slate-50 hover:text-[#072348]"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="leading-snug">{tip.title}</span>
                  </button>
                </li>
              ))}
            </ul>
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
        <div ref={coverLetterRef} className="w-[794px] bg-white p-14 text-slate-800">
          <div className="border-b-2 border-[#072348] pb-4">
            <p className="text-lg font-extrabold text-[#072348]">{displayName}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {[candidate?.profile?.phone, me?.email, candidate?.profile?.currentCity]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <h2 className="mt-6 text-base font-bold uppercase tracking-wide text-[#072348]">
            Thư ứng tuyển{coverRole.trim() ? ` — ${coverRole.trim()}` : ''}
          </h2>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {coverBody}
          </div>
        </div>
      </div>

      {/* Modal Quản lý CV */}
      {manageCvsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setManageCvsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072348]/40 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#072348]">
                Quản lý CV của tôi ({myCvList.length})
              </h3>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setManageCvsOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
              {myCvList.map((cvItem) => (
                <li
                  key={cvItem.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#072348]">{cvItem.fileName}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {cvItem.updatedAt}
                      {cvItem.isDefault ? ' · Mặc định từ hồ sơ' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setManageCvsOpen(false);
                        if (cvItem.isDefault && candidate && !draft) importFromProfile();
                        setSelectedId(cvItem.templateId || CV_TEMPLATES[0].id);
                        window.setTimeout(() => void onDownloadCv(), 60);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#072348] hover:bg-slate-50"
                    >
                      Tải PDF
                    </button>
                    {!cvItem.isDefault && (
                      <button
                        type="button"
                        onClick={() => removeSavedCv(cvItem.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                        aria-label="Xóa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal Mẹo & hướng dẫn */}
      {tipsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setTipsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072348]/40 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#072348]">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span>Mẹo &amp; hướng dẫn viết CV B2B</span>
              </h3>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setTipsModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              {CV_TIPS.filter((t) => !activeTipId || t.id === activeTipId).map((tip) => (
                <div key={tip.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-sm font-bold text-[#072348]">{tip.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{tip.summary}</p>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                    {tip.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
  anchor,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: CvDraftFieldHint;
  anchor?: string;
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
    <label id={anchor} className="block scroll-mt-28">
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
  anchor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: CvDraftFieldHint;
  anchor?: string;
}) {
  return (
    <label id={anchor} className="block scroll-mt-28">
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
