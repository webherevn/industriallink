'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CandidateStatus,
  JOB_READINESS_LABEL,
  SkillLevel,
  type CandidateExperienceView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { CvPreview } from '@/components/cv-preview';
import { JdRichEditor } from '@/components/jd-rich-editor';
import { ProfileAvatar } from '@/components/profile-avatar';
import { SafeHtml, looksLikeHtml, stripHtml } from '@/components/render-safe-html';
import { fetchMe } from '@/lib/auth';
import {
  fetchMyAvatarObjectUrl,
  getMyCandidate,
  updateMyCandidateIntro,
} from '@/lib/candidate';
import { draftFromCandidate } from '@/lib/cv-from-profile';
import { CV_TEMPLATES } from '@/lib/cv-templates';
import { downloadElementAsPdf } from '@/lib/download-cv';
import { formatSalary } from '@/lib/format';

function statusLookingLabel(status: CandidateStatus | undefined): {
  text: string;
  className: string;
} {
  switch (status) {
    case CandidateStatus.Searching:
    case CandidateStatus.Verified:
    case CandidateStatus.Completed:
      return {
        text: 'Đang tìm việc',
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      };
    case CandidateStatus.Archived:
      return {
        text: 'Tạm dừng tìm việc',
        className: 'bg-slate-100 text-slate-600 ring-slate-200',
      };
    default:
      return {
        text: 'Đang hoàn thiện',
        className: 'bg-amber-50 text-amber-700 ring-amber-200',
      };
  }
}

function formatBirthDate(birthDate?: string | null, birthYear?: number | null): string {
  if (birthDate) {
    const d = new Date(birthDate);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  if (birthYear) return String(birthYear);
  return 'Chưa cập nhật';
}

function parseCertificate(raw: string): {
  name: string;
  issuer: string | null;
  date: string | null;
} {
  const parts = raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return { name: parts[0], issuer: parts[1], date: parts[2] };
  }
  if (parts.length === 2) {
    return { name: parts[0], issuer: parts[1], date: null };
  }
  return { name: raw.trim(), issuer: null, date: null };
}

function formatExperiencePeriod(exp: CandidateExperienceView): string {
  const start = exp.startYear ?? '?';
  const end = exp.isCurrent ? 'Hiện tại' : (exp.endYear ?? '?');
  return `${start} – ${end}`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toEditorHtml(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  if (looksLikeHtml(raw)) return raw;
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function hobbiesToEditorHtml(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1 && looksLikeHtml(items[0])) return items[0];
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

const SKILL_LEVEL_OPTIONS: Array<{ value: SkillLevel; label: string }> = [
  { value: SkillLevel.Beginner, label: 'Cơ bản' },
  { value: SkillLevel.Intermediate, label: 'Trung cấp' },
  { value: SkillLevel.Advanced, label: 'Nâng cao' },
  { value: SkillLevel.Expert, label: 'Chuyên gia' },
];

function skillLevelLabel(level?: string | null): string | null {
  return SKILL_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? null;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadingCv, setDownloadingCv] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [editingHobbies, setEditingHobbies] = useState(false);
  const [hobbiesDraft, setHobbiesDraft] = useState('');
  const [hobbiesError, setHobbiesError] = useState<string | null>(null);
  const [editingSkills, setEditingSkills] = useState(false);
  const [skillsDraft, setSkillsDraft] = useState<Array<{ name: string; level: SkillLevel }>>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>(SkillLevel.Intermediate);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [cvExportAvatar, setCvExportAvatar] = useState<string | null>(null);
  const cvExportRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: avatarObjUrl } = useQuery({
    queryKey: ['my-avatar'],
    queryFn: fetchMyAvatarObjectUrl,
    enabled: Boolean(candidate?.hasAvatar),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    let cancelled = false;
    if (!avatarObjUrl) {
      setCvExportAvatar(null);
      return;
    }
    void fetch(avatarObjUrl)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          }),
      )
      .then((dataUrl) => {
        if (!cancelled) setCvExportAvatar(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCvExportAvatar(null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarObjUrl]);

  const saveAboutMutation = useMutation({
    mutationFn: (html: string) =>
      updateMyCandidateIntro({ summary: stripHtml(html) ? html : null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-candidate'], updated);
      setEditingAbout(false);
      setAboutError(null);
    },
    onError: (err) => {
      setAboutError(
        err instanceof Error ? err.message : 'Không lưu được giới thiệu bản thân. Vui lòng thử lại.',
      );
    },
  });

  const saveHobbiesMutation = useMutation({
    mutationFn: (html: string) =>
      updateMyCandidateIntro({ hobbies: stripHtml(html) ? [html] : [] }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-candidate'], updated);
      setEditingHobbies(false);
      setHobbiesError(null);
    },
    onError: (err) => {
      setHobbiesError(
        err instanceof Error ? err.message : 'Không lưu được sở thích. Vui lòng thử lại.',
      );
    },
  });

  const saveSkillsMutation = useMutation({
    mutationFn: (nextSkills: Array<{ name: string; level: SkillLevel }>) =>
      updateMyCandidateIntro({ skills: nextSkills }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['my-candidate'], updated);
      setEditingSkills(false);
      setNewSkillName('');
      setSkillsError(null);
    },
    onError: (err) => {
      setSkillsError(
        err instanceof Error ? err.message : 'Không lưu được kỹ năng. Vui lòng thử lại.',
      );
    },
  });

  function startEditSkills() {
    setSkillsDraft(
      skills.map((s) => ({
        name: s.name,
        level: (s.level as SkillLevel) || SkillLevel.Intermediate,
      })),
    );
    setNewSkillName('');
    setNewSkillLevel(SkillLevel.Intermediate);
    setSkillsError(null);
    setEditingSkills(true);
  }

  function addSkillToDraft() {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;
    setSkillsDraft((prev) => {
      if (prev.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, { name: trimmed, level: newSkillLevel }];
    });
    setNewSkillName('');
  }

  function onSaveSkills() {
    const trimmed = newSkillName.trim();
    const merged =
      trimmed && !skillsDraft.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
        ? [...skillsDraft, { name: trimmed, level: newSkillLevel }]
        : skillsDraft;
    saveSkillsMutation.mutate(merged);
  }

  const cvDraft = useMemo(
    () => (candidate ? draftFromCandidate(candidate, me?.email ?? '') : null),
    [candidate, me?.email],
  );
  const cvExportTemplate = useMemo(() => {
    if (cvDraft?.jobTrack === 'technical') {
      return CV_TEMPLATES.find((t) => t.id === 'tech-01') ?? CV_TEMPLATES[0];
    }
    if (cvDraft?.jobTrack === 'sales') {
      return CV_TEMPLATES.find((t) => t.id === 'sales-01') ?? CV_TEMPLATES[0];
    }
    return CV_TEMPLATES[0];
  }, [cvDraft?.jobTrack]);

  async function onDownloadCv() {
    if (!candidate || !cvDraft || !cvExportRef.current || downloadingCv) return;
    setDownloadError(null);
    setDownloadingCv(true);
    try {
      await downloadElementAsPdf(cvExportRef.current, `CV-${displayName}`);
    } catch {
      setDownloadError('Không xuất được file PDF CV. Vui lòng thử lại.');
    } finally {
      setDownloadingCv(false);
    }
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (!requested) return;
    const timer = window.setTimeout(() => {
      document.getElementById(requested)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  const looking = statusLookingLabel(candidate?.status);
  const displayName = (candidate?.displayName ?? me?.displayName ?? 'Ứng viên').replace(/\r/g, '');
  const profile = candidate?.profile;
  const sales = profile?.sales ?? null;
  const position = profile?.currentPosition ?? 'Chưa cập nhật vị trí';
  const industryBadge = profile?.specialization || profile?.industry?.split('/')[0]?.trim() || null;
  const about = profile?.summary || candidate?.aiProfile?.summary || profile?.careerObjective || null;
  const experiences = useMemo(() => candidate?.experiences ?? [], [candidate?.experiences]);
  const skills = useMemo(() => candidate?.skills ?? [], [candidate?.skills]);
  const certificates = useMemo(() => profile?.certificates ?? [], [profile?.certificates]);
  const hobbies = useMemo(() => profile?.hobbies ?? [], [profile?.hobbies]);

  const locationText =
    [profile?.ward, profile?.district, profile?.currentCity].filter(Boolean).join(', ') ||
    'Chưa cập nhật';
  const shortLocation = profile?.currentCity || locationText;

  const salaryLabel = (() => {
    const min = sales?.expectedSalaryMin ?? null;
    const max = sales?.expectedSalaryMax ?? sales?.expectedOte ?? null;
    if (min != null || max != null) {
      return formatSalary(min ?? max!, max ?? min!);
    }
    return 'Chưa cập nhật';
  })();

  const readinessLabel =
    sales?.jobReadiness &&
    (JOB_READINESS_LABEL[sales.jobReadiness as keyof typeof JOB_READINESS_LABEL] ??
      sales.jobReadiness);

  const hasEducation = Boolean(
    profile?.educationSchool ||
      profile?.educationMajor ||
      profile?.educationLevel ||
      profile?.educationClassification,
  );

  if (isLoading) {
    return (
      <AppShell wide>
        <p className="py-16 text-center text-slate-500">Đang tải hồ sơ...</p>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CandidateSidebar
          displayName={displayName}
          position={profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
          showProfileCard={false}
        />

        <div className="min-w-0 space-y-4">
          {/* Header Profile Card */}
          <section className="relative overflow-hidden rounded-2xl border border-[#dce6f4] bg-gradient-to-r from-white via-[#F9FBFF] to-[#EEF5FF] p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="w-fit shrink-0">
                  <ProfileAvatar
                    displayName={displayName}
                    email={me?.email}
                    hasAvatar={Boolean(candidate?.hasAvatar)}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-extrabold tracking-tight text-[#072348] sm:text-[26px]">
                      {displayName}
                    </h1>
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                        looking.className,
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {looking.text}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-sky-100">
                      {position}
                    </span>
                    {industryBadge ? (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {industryBadge}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {shortLocation}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {profile?.totalExperienceYears
                        ? `${profile.totalExperienceYears}+ năm kinh nghiệm`
                        : experiences.length > 0
                          ? `${experiences.length} công ty đã làm`
                          : 'Chưa cập nhật KN'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {profile?.phone || 'Chưa cập nhật SĐT'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {me?.email || 'Chưa có email'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 nút hành động phải */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/profile/edit"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3468]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Chỉnh sửa hồ sơ</span>
                </Link>
                <button
                  type="button"
                  disabled={downloadingCv || !cvDraft}
                  onClick={onDownloadCv}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  {downloadingCv ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>{downloadingCv ? 'Đang tạo PDF...' : 'Tải CV'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Xem trước hồ sơ</span>
                </button>
              </div>
            </div>
            {downloadError ? (
              <p className="mt-3 text-xs font-medium text-rose-600">{downloadError}</p>
            ) : null}
          </section>

          {/* Bản render ẩn khổ A4 dùng cho nút Tải CV PDF */}
          {cvDraft ? (
            <div
              className="pointer-events-none fixed -left-[9999px] top-0 z-[-1]"
              aria-hidden
            >
              <div ref={cvExportRef}>
                <CvPreview
                  draft={cvDraft}
                  template={cvExportTemplate}
                  avatarUrl={cvExportAvatar}
                  exportWidth={794}
                />
              </div>
            </div>
          ) : null}

          {/* Layout 2 cột chính */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,0.9fr)]">
            {/* Cột trái */}
            <div className="space-y-4">
              {/* 1. Thông tin cá nhân */}
              <SectionCard
                title="Thông tin cá nhân"
                icon={<UserRound className="h-4 w-4" />}
                editHref="/profile/edit?focus=fullName"
              >
                <dl className="divide-y divide-slate-100 text-[13px]">
                  <InfoRow
                    label="Ngày sinh"
                    value={formatBirthDate(profile?.birthDate, profile?.birthYear)}
                  />
                  <InfoRow label="Địa chỉ" value={locationText} />
                  <InfoRow label="Điện thoại" value={profile?.phone || 'Chưa cập nhật'} />
                  <InfoRow label="Email" value={me?.email || 'Chưa cập nhật'} />
                  <InfoRow label="Thu nhập kỳ vọng" value={salaryLabel} />
                  {readinessLabel ? (
                    <InfoRow label="Sẵn sàng nhận việc" value={String(readinessLabel)} />
                  ) : null}
                </dl>
              </SectionCard>

              {/* 2. Giới thiệu bản thân (ngay sau Thông tin cá nhân) */}
              <SectionCard
                title="Giới thiệu bản thân"
                icon={<FileText className="h-4 w-4" />}
                editing={editingAbout}
                onEdit={() => {
                  setAboutDraft(toEditorHtml(about));
                  setAboutError(null);
                  setEditingAbout(true);
                }}
              >
                {editingAbout ? (
                  <div className="space-y-3">
                    <JdRichEditor
                      value={aboutDraft}
                      onChange={setAboutDraft}
                      minRows={5}
                      disabled={saveAboutMutation.isPending}
                      placeholder="Giới thiệu ngắn gọn về kinh nghiệm, thế mạnh chuyên môn và định hướng nghề nghiệp hiện tại của bạn..."
                    />
                    {aboutError ? (
                      <p className="text-xs font-medium text-rose-600">{aboutError}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        {candidate?.aiProfile?.summary ? (
                          <button
                            type="button"
                            disabled={saveAboutMutation.isPending}
                            onClick={() =>
                              setAboutDraft(toEditorHtml(candidate.aiProfile?.summary))
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Dùng gợi ý AI</span>
                          </button>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={saveAboutMutation.isPending}
                          onClick={() => {
                            setEditingAbout(false);
                            setAboutError(null);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          disabled={saveAboutMutation.isPending}
                          onClick={() => saveAboutMutation.mutate(aboutDraft)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#072348] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d3468] disabled:opacity-60"
                        >
                          {saveAboutMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          <span>Lưu giới thiệu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : about ? (
                  looksLikeHtml(about) ? (
                    <SafeHtml
                      html={about}
                      className="profile-normalized-rich text-[13px] leading-relaxed text-slate-700"
                    />
                  ) : (
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">
                      {about}
                    </p>
                  )
                ) : (
                  <p className="text-[13px] text-slate-400">
                    Chưa có phần giới thiệu. Hãy cập nhật tóm tắt chuyên môn hoặc tải CV để AI hỗ trợ.
                  </p>
                )}
              </SectionCard>

              {/* 3. Kinh nghiệm làm việc */}
              <SectionCard
                id="experience"
                title="Kinh nghiệm làm việc"
                icon={<Briefcase className="h-4 w-4" />}
                editHref="/profile/edit?focus=experience"
              >
                {experiences.length === 0 ? (
                  <p className="text-[13px] text-slate-400">
                    Chưa có kinh nghiệm làm việc. Thêm công ty bạn đã từng công tác để tăng độ khớp.
                  </p>
                ) : (
                  <ul className="relative space-y-4 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-slate-200">
                    {experiences.map((exp) => (
                      <li key={exp.id} className="relative">
                        <span className="absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                        <Link
                          href="/profile/edit?focus=experience"
                          className="group flex items-start justify-between gap-3 rounded-xl p-1.5 -m-1.5 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-[#072348] group-hover:text-brand-600">
                              {exp.jobTitle}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">{exp.companyName}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                {formatExperiencePeriod(exp)}
                              </span>
                              {exp.latestRevenue != null && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    DS quản lý:{' '}
                                    <strong className="font-semibold text-slate-700">
                                      {formatSalary(exp.latestRevenue, exp.latestRevenue)}
                                    </strong>
                                  </span>
                                </>
                              )}
                              {exp.kpiAchievementPct != null && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    KPI:{' '}
                                    <strong className="font-semibold text-slate-700">
                                      {Math.round(exp.kpiAchievementPct)}%
                                    </strong>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 pt-1">
                  <Link
                    href="/profile/edit?focus=experience"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm kinh nghiệm</span>
                  </Link>
                </div>
              </SectionCard>

              {/* 4. Học vấn */}
              <SectionCard
                id="education"
                title="Học vấn"
                icon={<GraduationCap className="h-4 w-4" />}
                editHref="/profile/edit?focus=educationLevel"
              >
                {!hasEducation ? (
                  <p className="text-[13px] text-slate-400">
                    Chưa cập nhật thông tin học vấn. Bổ sung trường học và chuyên ngành của bạn.
                  </p>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-brand-700">
                        <GraduationCap className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-[#072348]">
                          {profile?.educationSchool || 'Đã tốt nghiệp'}
                        </p>
                        {(profile?.educationLevel || profile?.educationMajor) && (
                          <p className="mt-0.5 text-xs text-slate-600">
                            {[profile?.educationLevel, profile?.educationMajor]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {profile?.educationClassification && (
                          <p className="mt-1 text-[11.5px] text-slate-500">
                            Xếp loại:{' '}
                            <strong className="font-semibold text-slate-700">
                              {profile.educationClassification}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/profile/edit?focus=educationLevel"
                      aria-label="Chỉnh sửa học vấn"
                      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Cột phải */}
            <div className="space-y-4">
              {/* 1. Kỹ năng */}
              <SectionCard
                id="skills"
                title="Kỹ năng"
                icon={<SparklesIcon />}
                editing={editingSkills}
                onEdit={startEditSkills}
              >
                {editingSkills ? (
                  <div className="space-y-3">
                    {skillsDraft.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {skillsDraft.map((s) => (
                          <span
                            key={s.name}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            <span>{s.name}</span>
                            {skillLevelLabel(s.level) ? (
                              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200/80">
                                {skillLevelLabel(s.level)}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              aria-label={`Xóa ${s.name}`}
                              disabled={saveSkillsMutation.isPending}
                              onClick={() =>
                                setSkillsDraft((prev) =>
                                  prev.filter((item) => item.name !== s.name),
                                )
                              }
                              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Nhập kỹ năng bên dưới rồi bấm Thêm hoặc nhấn Enter.
                      </p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={newSkillName}
                        disabled={saveSkillsMutation.isPending}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkillToDraft();
                          }
                        }}
                        placeholder="VD: PLC Siemens, AutoCAD, Đàm phán B2B..."
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={newSkillLevel}
                          disabled={saveSkillsMutation.isPending}
                          onChange={(e) => setNewSkillLevel(e.target.value as SkillLevel)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
                        >
                          {SKILL_LEVEL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={saveSkillsMutation.isPending || !newSkillName.trim()}
                          onClick={addSkillToDraft}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-100 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>

                    {skillsError ? (
                      <p className="text-xs font-medium text-rose-600">{skillsError}</p>
                    ) : null}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={saveSkillsMutation.isPending}
                        onClick={() => {
                          setEditingSkills(false);
                          setSkillsError(null);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={saveSkillsMutation.isPending}
                        onClick={onSaveSkills}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#072348] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d3468] disabled:opacity-60"
                      >
                        {saveSkillsMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        <span>Lưu kỹ năng</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {skills.map((s) => (
                          <span
                            key={`${s.skillId ?? s.name}-${s.name}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            <span>{s.name}</span>
                            {skillLevelLabel(s.level) ? (
                              <span className="text-[10.5px] font-normal text-slate-500">
                                · {skillLevelLabel(s.level)}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Chưa có kỹ năng nào được thêm.</p>
                    )}

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={startEditSkills}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Thêm kỹ năng</span>
                      </button>
                    </div>
                  </>
                )}
              </SectionCard>

              {/* 2. Chứng chỉ */}
              <SectionCard
                id="certificates"
                title="Chứng chỉ"
                icon={<Award className="h-4 w-4" />}
                editHref="/profile/edit?focus=certificates"
              >
                {certificates.length > 0 ? (
                  <ul className="space-y-2.5">
                    {certificates.map((raw) => {
                      const cert = parseCertificate(raw);
                      return (
                        <li
                          key={raw}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-600">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#072348]">
                                {cert.name}
                              </p>
                              {cert.issuer && (
                                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                  {cert.issuer}
                                </p>
                              )}
                            </div>
                          </div>
                          {cert.date && (
                            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
                              {cert.date}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">Chưa có chứng chỉ nào được thêm.</p>
                )}

                <div className="mt-3">
                  <Link
                    href="/profile/edit?focus=certificates"
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm chứng chỉ</span>
                  </Link>
                </div>
              </SectionCard>

              {/* 3. Sở thích */}
              <SectionCard
                id="interests"
                title="Sở thích"
                icon={<Heart className="h-4 w-4" />}
                editing={editingHobbies}
                onEdit={() => {
                  setHobbiesDraft(hobbiesToEditorHtml(hobbies));
                  setHobbiesError(null);
                  setEditingHobbies(true);
                }}
              >
                {editingHobbies ? (
                  <div className="space-y-3">
                    <JdRichEditor
                      value={hobbiesDraft}
                      onChange={setHobbiesDraft}
                      minRows={4}
                      disabled={saveHobbiesMutation.isPending}
                      placeholder="Chia sẻ sở thích cá nhân, hoạt động ngoại khóa, thể thao, đọc sách..."
                    />
                    {hobbiesError ? (
                      <p className="text-xs font-medium text-rose-600">{hobbiesError}</p>
                    ) : null}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={saveHobbiesMutation.isPending}
                        onClick={() => {
                          setEditingHobbies(false);
                          setHobbiesError(null);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={saveHobbiesMutation.isPending}
                        onClick={() => saveHobbiesMutation.mutate(hobbiesDraft)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#072348] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0d3468] disabled:opacity-60"
                      >
                        {saveHobbiesMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        <span>Lưu sở thích</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {hobbies.length === 1 && looksLikeHtml(hobbies[0]) ? (
                      <SafeHtml
                        html={hobbies[0]}
                        className="profile-normalized-rich text-[13px] leading-relaxed text-slate-700"
                      />
                    ) : hobbies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {hobbies.map((hobby) => (
                          <span
                            key={hobby}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            <Heart className="h-3 w-3 text-slate-400" />
                            {hobby}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Chưa có sở thích nào được thêm.</p>
                    )}

                    {hobbies.length === 0 ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setHobbiesDraft(hobbiesToEditorHtml(hobbies));
                            setHobbiesError(null);
                            setEditingHobbies(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-sky-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Thêm sở thích</span>
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Xem trước hồ sơ */}
      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-preview-title"
          onClick={() => setPreviewOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072348]/45 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dce6f4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-[#072348] px-5 py-4 text-white">
              <div>
                <h2 id="profile-preview-title" className="text-base font-bold">
                  Xem trước hồ sơ ứng viên
                </h2>
                <p className="text-xs text-white/75">
                  Bản hiển thị tổng quan thông tin chuyên môn của bạn
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setPreviewOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-4">
                <ProfileAvatar
                  displayName={displayName}
                  email={me?.email}
                  hasAvatar={Boolean(candidate?.hasAvatar)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold text-[#072348]">{displayName}</h3>
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                        looking.className,
                      )}
                    >
                      {looking.text}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-brand-700">
                    {position}
                    {industryBadge ? ` · ${industryBadge}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {shortLocation} · {profile?.phone || 'Chưa cập nhật SĐT'} ·{' '}
                    {me?.email || 'Chưa có email'} · Thu nhập kỳ vọng: {salaryLabel}
                  </p>
                </div>
              </div>

              {about && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Giới thiệu bản thân
                  </h4>
                  {looksLikeHtml(about) ? (
                    <SafeHtml
                      html={about}
                      className="profile-normalized-rich mt-1.5 text-sm leading-relaxed text-slate-700"
                    />
                  ) : (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {about}
                    </p>
                  )}
                </div>
              )}

              {hobbies.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Sở thích
                  </h4>
                  {hobbies.length === 1 && looksLikeHtml(hobbies[0]) ? (
                    <SafeHtml
                      html={hobbies[0]}
                      className="profile-normalized-rich mt-1.5 text-sm leading-relaxed text-slate-700"
                    />
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hobbies.map((hobby) => (
                        <span
                          key={hobby}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                        >
                          {hobby}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {experiences.length > 0 && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    Kinh nghiệm làm việc
                  </h4>
                  <ul className="mt-2 space-y-2.5">
                    {experiences.map((exp) => (
                      <li
                        key={exp.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-bold text-[#072348]">{exp.jobTitle}</p>
                          <span className="text-xs text-slate-500">
                            {formatExperiencePeriod(exp)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600">{exp.companyName}</p>
                        {(exp.jobDescription || exp.highlights) && (
                          <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                            {exp.jobDescription || exp.highlights}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {hasEducation && (
                  <div className="rounded-xl border border-slate-100 p-3.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      Học vấn
                    </h4>
                    <p className="mt-1.5 text-sm font-bold text-[#072348]">
                      {profile?.educationSchool || 'Đã tốt nghiệp'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {[profile?.educationLevel, profile?.educationMajor]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                )}

                {skills.length > 0 && (
                  <div className="rounded-xl border border-slate-100 p-3.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      Kỹ năng ({skills.length})
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {skills.map((s) => (
                        <span
                          key={`${s.skillId ?? s.name}-${s.name}`}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Đóng
              </button>
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d3468]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Chỉnh sửa hồ sơ
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SectionCard({
  id,
  title,
  icon,
  editHref,
  onEdit,
  editing,
  children,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  editHref?: string;
  onEdit?: () => void;
  editing?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[#dce6f4] bg-white p-5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#072348]">
          <span className="text-brand-600">{icon}</span>
          <span>{title}</span>
        </h2>
        {onEdit ? (
          !editing ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-800"
            >
              <Pencil className="h-3 w-3" />
              <span>Chỉnh sửa</span>
            </button>
          ) : null
        ) : editHref ? (
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-800"
          >
            <Pencil className="h-3 w-3" />
            <span>Chỉnh sửa</span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function SparklesIcon() {
  return <Award className="h-4 w-4" />;
}
