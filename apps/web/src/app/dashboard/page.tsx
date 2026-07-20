'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Heart,
  LayoutGrid,
  Linkedin,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Quote,
  Settings2,
  Sparkles,
  Target,
  Upload,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ApplicationStatus,
  CandidateStatus,
  JobTrack,
  SkillLevel,
  JOB_TRACK_LABEL,
  type ApplicationView,
  type CareerAdviceView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { PaginationBar } from '@/components/pagination-bar';
import { ProfileAvatar } from '@/components/profile-avatar';
import { fetchMe } from '@/lib/auth';
import { myApplications } from '@/lib/applications';
import { getMyCandidate } from '@/lib/candidate';
import { getCareerAdvice } from '@/lib/career';
import {
  APPLICATION_STATUS_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';

type ProfileTab =
  | 'overview'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certificates'
  | 'career'
  | 'interests';

const ACTIVITY_PAGE_SIZE = 4;

const SKILL_LEVEL_PCT: Record<SkillLevel, number> = {
  [SkillLevel.Beginner]: 35,
  [SkillLevel.Intermediate]: 60,
  [SkillLevel.Advanced]: 82,
  [SkillLevel.Expert]: 95,
};

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'experience', label: 'Kinh nghiệm' },
  { id: 'education', label: 'Học vấn' },
  { id: 'skills', label: 'Kỹ năng' },
  { id: 'certificates', label: 'Chứng chỉ' },
  { id: 'career', label: 'Lộ trình' },
  { id: 'interests', label: 'Sở thích' },
];

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
        text: 'Đang hoàn thiện hồ sơ',
        className: 'bg-amber-50 text-amber-700 ring-amber-200',
      };
  }
}

function appStatusBadge(status: ApplicationView['status']): string {
  switch (status) {
    case ApplicationStatus.Interview:
      return 'bg-violet-50 text-violet-700';
    case ApplicationStatus.Offer:
      return 'bg-orange-50 text-orange-700';
    case ApplicationStatus.Hired:
      return 'bg-teal-50 text-teal-700';
    case ApplicationStatus.Rejected:
    case ApplicationStatus.Withdrawn:
      return 'bg-slate-100 text-slate-600';
    case ApplicationStatus.Screening:
      return 'bg-sky-50 text-sky-700';
    default:
      return 'bg-emerald-50 text-emerald-700';
  }
}

export default function DashboardPage() {
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [track, setTrack] = useState<JobTrack | undefined>(undefined);
  const [activityPage, setActivityPage] = useState(1);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate, isLoading } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });
  const { data: applications } = useQuery({
    queryKey: ['my-applications'],
    queryFn: myApplications,
    retry: false,
  });

  const hasAnalysis = Boolean(
    candidate?.aiProfile?.summary || candidate?.profile?.summary || (candidate?.skills.length ?? 0) > 0,
  );

  const { data: career, isLoading: careerLoading } = useQuery({
    queryKey: ['career-advice', track],
    queryFn: () => getCareerAdvice(track),
    enabled: hasAnalysis,
    retry: false,
  });

  const looking = statusLookingLabel(candidate?.status);
  const displayName = candidate?.displayName ?? me?.displayName ?? 'Ứng viên';
  const position = candidate?.profile?.currentPosition ?? 'Chưa cập nhật vị trí';
  const about =
    candidate?.profile?.summary ||
    candidate?.aiProfile?.summary ||
    candidate?.profile?.careerObjective ||
    null;

  const technicalSkills = useMemo(() => {
    const list = candidate?.skills ?? [];
    return [...list].sort(
      (a, b) => SKILL_LEVEL_PCT[b.level] - SKILL_LEVEL_PCT[a.level],
    );
  }, [candidate?.skills]);

  const softSkills = useMemo(() => {
    const fromAi = candidate?.aiProfile?.strengths ?? [];
    if (fromAi.length) return fromAi.slice(0, 8);
    return [] as string[];
  }, [candidate?.aiProfile?.strengths]);

  const featuredSkills = technicalSkills.slice(0, 10);

  const careerMilestones = useMemo(() => {
    if (!career?.ladder?.length) return [];
    return career.ladder.filter((s) => s.status === 'past' || s.status === 'current');
  }, [career]);

  const recentApps = useMemo(() => {
    const list = [...(applications ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return list;
  }, [applications]);

  const activityTotalPages = Math.max(1, Math.ceil(recentApps.length / ACTIVITY_PAGE_SIZE));
  const activityPageSafe = Math.min(activityPage, activityTotalPages);
  const activityItems = recentApps.slice(
    (activityPageSafe - 1) * ACTIVITY_PAGE_SIZE,
    activityPageSafe * ACTIVITY_PAGE_SIZE,
  );

  const salaryLabel = career
    ? formatSalary(career.salaryCurrent.min, career.salaryCurrent.max)
    : 'Cập nhật sau phân tích CV';

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
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
          showProfileCard={false}
        />

        <div className="min-w-0 space-y-4 animate-soft-rise">
        {/* Header profile */}
        <section className="profile-card relative overflow-hidden p-5 sm:p-6">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60"
            style={{
              background:
                'radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.12), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(7,35,72,0.08), transparent 45%)',
            }}
          />
          <div className="relative flex flex-wrap items-start gap-5">
            <ProfileAvatar
              displayName={displayName}
              email={me?.email}
              hasAvatar={Boolean(candidate?.hasAvatar)}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                  {displayName}
                </h1>
                {(candidate?.status === CandidateStatus.Verified ||
                  candidate?.status === CandidateStatus.Searching) && (
                  <BadgeCheck className="h-5 w-5 text-brand-500" aria-label="Đã xác thực" />
                )}
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    looking.className,
                  )}
                >
                  {looking.text}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-600">{position}</p>
                {candidate?.profile?.specialization || candidate?.profile?.industry ? (
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                    {candidate?.profile?.specialization ||
                      candidate?.profile?.industry?.split('/')[0]}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-x-6 gap-y-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <Meta icon={<MapPin className="h-3.5 w-3.5" />} text="Việt Nam · Công nghiệp" />
                <Meta
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  text={
                    candidate?.profile?.totalExperienceYears
                      ? `${candidate.profile.totalExperienceYears} năm kinh nghiệm`
                      : 'Chưa cập nhật KN'
                  }
                />
                <Meta
                  icon={<Target className="h-3.5 w-3.5" />}
                  text={
                    typeof candidate?.profileCompletion === 'number'
                      ? `Hồ sơ ${candidate.profileCompletion}%`
                      : 'Đang hoàn thiện'
                  }
                />
                <Meta
                  icon={<Mail className="h-3.5 w-3.5" />}
                  text={me?.email ?? 'Chưa có email'}
                />
                <Meta
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  text={
                    candidate?.aiProfile?.aiScore != null
                      ? `Điểm AI ${candidate.aiProfile.aiScore}/100`
                      : 'Chưa có điểm AI'
                  }
                />
                <Meta
                  icon={<Linkedin className="h-3.5 w-3.5" />}
                  text={candidate?.code ? `Mã UV: ${candidate.code}` : '—'}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-start gap-2">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600 hover:shadow-md active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4" />
                Chỉnh sửa hồ sơ
              </Link>
              <Link
                href="/account"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                title="Cài đặt tài khoản"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="relative mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <QuickStat
              icon={<Wallet className="h-4 w-4" />}
              label="Mức lương tham chiếu"
              value={salaryLabel}
              accent
            />
            <QuickStat
              icon={<Clock className="h-4 w-4" />}
              label="Hình thức làm việc"
              value="Toàn thời gian"
            />
            <QuickStat
              icon={<BarChart3 className="h-4 w-4" />}
              label="Cấp bậc"
              value={
                candidate?.profile?.jobLevel
                  ? formatJobLevel(candidate.profile.jobLevel)
                  : career?.currentLevelLabel ?? 'Chưa cập nhật'
              }
            />
            <QuickStat
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Ngành quan tâm"
              value={candidate?.profile?.industry ?? 'Công nghiệp / B2B'}
            />
          </div>
        </section>

        {/* Tabs */}
        <div className="overflow-x-auto border-b border-slate-200">
          <nav className="flex min-w-max gap-0.5" aria-label="Mục hồ sơ">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={clsx(
                  'relative px-4 py-3 text-[13px] font-semibold transition-colors duration-200',
                  tab === t.id
                    ? 'text-amber-700'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label}
                <span
                  className={clsx(
                    'absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-amber-500 transition-all duration-200',
                    tab === t.id ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0',
                  )}
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Body */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {(tab === 'overview' || tab === 'experience') && (
              <>
                {tab === 'overview' && (
                  <ProfileCard title="Giới thiệu bản thân" icon={<Quote className="h-4 w-4" />}>
                    {about ? (
                      <p className="text-sm leading-relaxed text-slate-600">{about}</p>
                    ) : (
                      <EmptyHint
                        text="Chưa có phần giới thiệu. Tải CV để AI tạo tóm tắt hồ sơ."
                        href="/upload"
                        cta="Tải CV ngay"
                      />
                    )}
                  </ProfileCard>
                )}

                <ProfileCard
                  title={tab === 'overview' ? 'Kinh nghiệm nổi bật' : 'Lộ trình cấp bậc'}
                  icon={<Briefcase className="h-4 w-4" />}
                >
                  {careerLoading && (
                    <p className="text-sm text-slate-500">Đang tải lộ trình nghề nghiệp...</p>
                  )}
                  {!careerLoading && careerMilestones.length === 0 && (
                    <EmptyHint
                      text="Chưa có dữ liệu kinh nghiệm chi tiết. Hệ thống sẽ suy luận cấp bậc từ CV sau khi phân tích."
                      href="/upload"
                      cta="Phân tích CV"
                    />
                  )}
                  {!careerLoading && careerMilestones.length > 0 && (
                    <ol className="relative space-y-0 border-l-2 border-slate-100 pl-5">
                      {careerMilestones.map((step) => (
                        <li
                          key={step.code}
                          className="group relative pb-5 last:pb-0"
                        >
                          <span
                            className={clsx(
                              'absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full ring-4 transition-transform duration-200 group-hover:scale-125',
                              step.status === 'current'
                                ? 'bg-amber-500 ring-amber-100'
                                : 'bg-brand-400 ring-brand-50',
                            )}
                          />
                          <div className="rounded-xl border border-transparent px-2 py-1 transition-colors duration-200 group-hover:border-slate-100 group-hover:bg-slate-50/80">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{step.label}</p>
                              <span
                                className={clsx(
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  step.status === 'current'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500',
                                )}
                              >
                                {step.status === 'current' ? 'Hiện tại' : 'Đã qua'}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {career?.trackLabel ?? 'Khối nghề'} ·{' '}
                              {JOB_TRACK_LABEL[career?.track as JobTrack] ?? ''}
                            </p>
                            {step.status === 'current' && career?.summary && (
                              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                {career.summary}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {tab === 'overview' && careerMilestones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab('experience')}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 transition hover:gap-1.5 hover:text-amber-700"
                    >
                      Xem toàn bộ lộ trình cấp bậc
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </ProfileCard>

                {tab === 'overview' && (
                  <ProfileCard title="Kỹ năng nổi bật" icon={<Award className="h-4 w-4" />}>
                    {featuredSkills.length === 0 ? (
                      <EmptyHint
                        text="Chưa có kỹ năng. Tải CV để AI trích xuất kỹ năng công nghiệp."
                        href="/upload"
                        cta="Thêm từ CV"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {featuredSkills.map((s) => (
                          <span key={s.name} className="profile-skill-pill">
                            {s.name}
                          </span>
                        ))}
                        <Link
                          href="/upload"
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-50"
                        >
                          <Plus className="h-3 w-3" /> Thêm kỹ năng
                        </Link>
                      </div>
                    )}
                  </ProfileCard>
                )}
              </>
            )}

            {tab === 'skills' && (
              <ProfileCard title="Toàn bộ kỹ năng" icon={<Award className="h-4 w-4" />}>
                {technicalSkills.length === 0 ? (
                  <EmptyHint text="Chưa có kỹ năng." href="/upload" cta="Tải CV" />
                ) : (
                  <ul className="space-y-3">
                    {technicalSkills.map((s) => (
                      <SkillBar key={s.name} name={s.name} pct={SKILL_LEVEL_PCT[s.level]} />
                    ))}
                  </ul>
                )}
              </ProfileCard>
            )}

            {tab === 'education' && (
              <ProfileCard title="Học vấn" icon={<GraduationCap className="h-4 w-4" />}>
                <EmptyHint
                  text="Mục học vấn chi tiết sẽ được bổ sung từ CV có cấu trúc. Hiện nền tảng ưu tiên kỹ năng & cấp bậc công nghiệp."
                  href="/upload"
                  cta="Cập nhật từ CV"
                />
              </ProfileCard>
            )}

            {tab === 'certificates' && (
              <ProfileCard title="Chứng chỉ" icon={<BadgeCheck className="h-4 w-4" />}>
                <EmptyHint
                  text="Chưa có chứng chỉ. Các chứng chỉ công nghiệp (PLC, PMP, Lean…) sẽ hiển thị tại đây khi có trong hồ sơ."
                  href="/upload"
                  cta="Tải CV có chứng chỉ"
                />
              </ProfileCard>
            )}

            {tab === 'interests' && (
              <ProfileCard title="Định hướng & sở thích nghề" icon={<Heart className="h-4 w-4" />}>
                {candidate?.profile?.careerObjective || candidate?.aiProfile?.careerPath ? (
                  <div className="space-y-3 text-sm text-slate-600">
                    {candidate?.profile?.careerObjective && (
                      <p>{candidate.profile.careerObjective}</p>
                    )}
                    {candidate?.aiProfile?.careerPath && (
                      <p className="rounded-xl bg-amber-50/80 px-3 py-2 text-amber-800 ring-1 ring-amber-100">
                        <span className="font-semibold">AI gợi ý: </span>
                        {candidate.aiProfile.careerPath}
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyHint text="Chưa có định hướng nghề." href="/upload" cta="Phân tích CV" />
                )}
              </ProfileCard>
            )}

            {tab === 'career' && (
              <CareerPanel
                career={career}
                loading={careerLoading}
                track={track}
                onTrack={setTrack}
                hasAnalysis={hasAnalysis}
              />
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <ProfileCard title="Kỹ năng chuyên môn" icon={<BarChart3 className="h-4 w-4" />}>
              {technicalSkills.length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có kỹ năng chuyên môn.</p>
              ) : (
                <ul className="space-y-3">
                  {technicalSkills.slice(0, 6).map((s) => (
                    <SkillBar key={s.name} name={s.name} pct={SKILL_LEVEL_PCT[s.level]} compact />
                  ))}
                </ul>
              )}
            </ProfileCard>

            {softSkills.length > 0 && (
              <ProfileCard title="Điểm mạnh (AI)" icon={<Sparkles className="h-4 w-4" />}>
                <div className="flex flex-wrap gap-2">
                  {softSkills.map((s) => (
                    <span key={s} className="profile-skill-pill">
                      {s}
                    </span>
                  ))}
                </div>
              </ProfileCard>
            )}

            <ProfileCard title="CV của tôi" icon={<FileText className="h-4 w-4" />}>
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition hover:border-amber-200 hover:bg-amber-50/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {hasAnalysis ? 'CV đã phân tích' : 'Chưa có CV'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {candidate?.aiProfile?.lastAnalyzedAt
                      ? `Cập nhật: ${new Date(candidate.aiProfile.lastAnalyzedAt).toLocaleDateString('vi-VN')}`
                      : 'Tải lên để AI tạo hồ sơ số'}
                  </p>
                </div>
              </div>
              <Link
                href="/upload"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600 hover:shadow-md active:scale-[0.98]"
              >
                <Upload className="h-3.5 w-3.5" />
                {hasAnalysis ? 'Tải CV mới' : 'Tạo hồ sơ từ CV'}
              </Link>
            </ProfileCard>

            <ProfileCard title="Hoạt động gần đây" icon={<CheckCircle2 className="h-4 w-4" />}>
              {activityItems.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Chưa có hoạt động ứng tuyển.{' '}
                  <Link href="/jobs" className="font-semibold text-amber-600 hover:underline">
                    Tìm việc
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {activityItems.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-2.5 rounded-lg px-1 py-1 transition hover:bg-slate-50"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Briefcase className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {a.jobTitle}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{a.companyName}</p>
                      </div>
                      <span
                        className={clsx(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          appStatusBadge(a.status),
                        )}
                      >
                        {APPLICATION_STATUS_LABEL[a.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {recentApps.length > ACTIVITY_PAGE_SIZE && (
                <PaginationBar
                  page={activityPageSafe}
                  totalPages={activityTotalPages}
                  totalItems={recentApps.length}
                  pageSize={ACTIVITY_PAGE_SIZE}
                  itemLabel="hoạt động"
                  onChange={setActivityPage}
                />
              )}
              {recentApps.length > 0 && (
                <Link
                  href="/applications"
                  className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
                >
                  Xem tất cả đơn <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </ProfileCard>

            <div className="profile-card overflow-hidden bg-gradient-to-br from-amber-50 via-white to-brand-50 p-4 ring-1 ring-amber-100">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Gợi ý cải thiện hồ sơ</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    {typeof candidate?.profileCompletion === 'number' &&
                    candidate.profileCompletion < 100
                      ? `Hồ sơ đang ${candidate.profileCompletion}%. Bổ sung CV và kỹ năng để AI gợi ý việc chính xác hơn.`
                      : 'Xem việc AI gợi ý dựa trên kỹ năng và cấp bậc của bạn.'}
                  </p>
                </div>
              </div>
              <Link
                href="/recommended"
                className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                Xem gợi ý việc làm AI
              </Link>
            </div>
          </aside>
        </div>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 truncate">
      <span className="text-slate-400">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function QuickStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-50/80">
      <div
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
          accent
            ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'
            : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ProfileCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="profile-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          {icon && <span className="text-amber-500">{icon}</span>}
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({
  text,
  href,
  cta,
}: {
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center">
      <p className="text-xs leading-relaxed text-slate-500">{text}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-brand-500/25 transition hover:bg-brand-600 hover:shadow-md active:scale-[0.98]"
      >
        <Upload className="h-3.5 w-3.5" />
        {cta}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function SkillBar({
  name,
  pct,
  compact,
}: {
  name: string;
  pct: number;
  compact?: boolean;
}) {
  return (
    <li>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className={clsx(
            'truncate font-medium text-slate-700',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {name}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-amber-600">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function CareerPanel({
  career,
  loading,
  track,
  onTrack,
  hasAnalysis,
}: {
  career: CareerAdviceView | undefined;
  loading: boolean;
  track: JobTrack | undefined;
  onTrack: (t: JobTrack | undefined) => void;
  hasAnalysis: boolean;
}) {
  if (!hasAnalysis) {
    return (
      <ProfileCard title="Lộ trình nghề nghiệp" icon={<Target className="h-4 w-4" />}>
        <EmptyHint
          text="Cần phân tích CV trước khi xem lộ trình & khung lương."
          href="/upload"
          cta="Tải CV"
        />
      </ProfileCard>
    );
  }

  return (
    <ProfileCard title="Lộ trình nghề nghiệp & lương" icon={<Target className="h-4 w-4" />}>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onTrack(undefined)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            !track
              ? 'bg-amber-500 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          Theo hồ sơ
        </button>
        {Object.values(JobTrack).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTrack(t)}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              track === t
                ? 'bg-amber-500 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {JOB_TRACK_LABEL[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Đang phân tích lộ trình...</p>}

      {career && (
        <>
          <p className="text-sm text-slate-600">{career.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {career.ladder.map((step) => (
              <span
                key={step.code}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  step.status === 'current' && 'bg-amber-500 font-semibold text-white',
                  step.status === 'next' &&
                    'border border-amber-300 bg-amber-50 text-amber-800',
                  step.status === 'past' && 'bg-slate-100 text-slate-500',
                  step.status === 'future' &&
                    'border border-dashed border-slate-200 text-slate-400',
                )}
              >
                {step.label}
                {step.status === 'current' ? ' · hiện tại' : ''}
                {step.status === 'next' ? ' · tiếp theo' : ''}
              </span>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-amber-50/80 p-4 ring-1 ring-amber-100">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Sẵn sàng
              </p>
              <p className="mt-1 text-3xl font-extrabold text-amber-600">
                {career.readinessScore}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Lương bậc hiện tại
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatSalary(career.salaryCurrent.min, career.salaryCurrent.max)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Lương bậc tiếp
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {career.salaryNext
                  ? formatSalary(career.salaryNext.min, career.salaryNext.max)
                  : 'Đã ở bậc cao'}
              </p>
            </div>
          </div>
          {career.skillGaps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-700">Kỹ năng nên bổ sung</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {career.skillGaps.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-100"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {career.actionPlan.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {career.actionPlan.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </ProfileCard>
  );
}

