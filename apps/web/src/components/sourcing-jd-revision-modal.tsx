'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertCircle, Loader2, Lock, RefreshCw, Save, Sparkles, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CUSTOMER_SEGMENTS, DEAL_TYPE_LABEL, DEAL_TYPE_OPTIONS, DRIVER_LICENSE_TYPES, ExperienceBand, JD_TECHNICAL_AUTONOMY_OPTIONS, JD_TECHNICAL_SHIFT_OPTIONS, JOB_LEVEL_LABEL, JobTrack, LANGUAGE_OPTIONS, MARKET_REGIONS, TECHNICAL_WORK_TYPES, TRAVEL_ABILITY_LABEL, TravelAbility, WORK_ENVIRONMENT_OPTIONS, type CandidateMatchView, type JobTechnicalCriteria, type RecruiterSourcingWorkspace } from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { JdSalesForm } from '@/components/jd-sales-form';
import { JdTechnicalForm } from '@/components/jd-technical-form';
import { LocationPicker } from '@/components/location-picker';
import { Button, MoneyInput } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EXPERIENCE_LABEL, formatVndAmount } from '@/lib/format';
import { emptyJdSalesForm, formToCreateJobRequest, jobViewToForm, type JdSalesFormState } from '@/lib/jd-sales-form';
import { emptyJdTechnicalForm, formToCreateTechnicalJobRequest, jobViewToTechnicalForm, type JdTechnicalFormState } from '@/lib/jd-technical-form';
import { getJob, updateJob } from '@/lib/jobs';
import { sourcingCandidatesForJob } from '@/lib/matching';
import { consumeRecruiterSourcing } from '@/lib/recruiter-billing';

function trackFromJob(job: {
  jobTrack?: string | null;
  jobLevel?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
}): JobTrack {
  if (
    job.jobTrack === JobTrack.Technical ||
    job.jobLevel?.startsWith('technical.') ||
    job.technicalCriteria
  ) {
    return JobTrack.Technical;
  }
  if (job.jobTrack === JobTrack.Sales || job.jobLevel?.startsWith('sales.') || job.salesCriteria) {
    return JobTrack.Sales;
  }
  return JobTrack.Sales;
}
// ============================================================================
// 2. MODAL TỐI ƯU & ĐIỀU CHỈNH TIÊU CHÍ SĂN (SMART TUNING PANEL 5 VAN)
// ============================================================================

const EXP_RELAX_MAP: Partial<Record<ExperienceBand, ExperienceBand>> = {
  [ExperienceBand.Over5]: ExperienceBand.From3To5,
  [ExperienceBand.From3To5]: ExperienceBand.From1To3,
  [ExperienceBand.From1To3]: ExperienceBand.Under1,
  [ExperienceBand.Under1]: ExperienceBand.None,
};

function fmtMillionShort(raw: string): string {
  const n = Number(raw);
  if (!n || !Number.isFinite(n)) return 'Thoả thuận';
  if (n >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}tr`;
  return formatVndAmount(n);
}

function buildSalesDiffNotes(before: JdSalesFormState, after: JdSalesFormState): string[] {
  const changes: string[] = [];
  if (before.salaryMin !== after.salaryMin || before.salaryMax !== after.salaryMax) {
    changes.push(
      `Lương ${fmtMillionShort(before.salaryMin)}–${fmtMillionShort(before.salaryMax)} → ${fmtMillionShort(after.salaryMin)}–${fmtMillionShort(after.salaryMax)}`,
    );
  }
  if (before.experienceBand !== after.experienceBand) {
    const bLabel = before.experienceBand ? EXPERIENCE_LABEL[before.experienceBand] : 'Chưa chọn';
    const aLabel = after.experienceBand ? EXPERIENCE_LABEL[after.experienceBand] : 'Chưa chọn';
    changes.push(`Kinh nghiệm ${bLabel} → ${aLabel}`);
  }
  if (before.jobLevel !== after.jobLevel) {
    // (2) Cấp bậc là bất biến sau khi kích hoạt chiến dịch Săn → không ghi nhận là thay đổi.
  }
  if (before.location !== after.location) {
    changes.push(`Địa điểm: ${after.location || 'Toàn quốc'}`);
  }
  if (before.industryHardMode !== after.industryHardMode) {
    const modeLabel =
      after.industryHardMode === 'off'
        ? 'Không lọc cứng ngành'
        : after.industryHardMode === 'near'
          ? 'Ngành gần ≥85%'
          : 'Đúng ngành 100%';
    changes.push(`Lọc ngành → ${modeLabel}`);
  }
  if (before.marketsCovered.join(',') !== after.marketsCovered.join(',')) {
    changes.push(`Thị trường phụ trách (${after.marketsCovered.length} vùng)`);
  }
  if (before.customerSegments.join(',') !== after.customerSegments.join(',')) {
    changes.push(`Tệp khách hàng (${after.customerSegments.length} nhóm)`);
  }
  if (before.dealTypes.join(',') !== after.dealTypes.join(',')) {
    changes.push(`Loại hình bán hàng (${after.dealTypes.length} loại)`);
  }
  if (
    before.languages.join(',') !== after.languages.join(',') ||
    before.driverLicenses.join(',') !== after.driverLicenses.join(',') ||
    before.travelAbility !== after.travelAbility
  ) {
    changes.push('Điều kiện phụ (Ngoại ngữ / Bằng lái / Công tác)');
  }
  return changes;
}

function buildTechDiffNotes(before: JdTechnicalFormState, after: JdTechnicalFormState): string[] {
  const changes: string[] = [];
  if (before.salaryMin !== after.salaryMin || before.salaryMax !== after.salaryMax) {
    changes.push(
      `Lương ${fmtMillionShort(before.salaryMin)}–${fmtMillionShort(before.salaryMax)} → ${fmtMillionShort(after.salaryMin)}–${fmtMillionShort(after.salaryMax)}`,
    );
  }
  if (before.experienceBand !== after.experienceBand) {
    const bLabel = before.experienceBand ? EXPERIENCE_LABEL[before.experienceBand] : 'Chưa chọn';
    const aLabel = after.experienceBand ? EXPERIENCE_LABEL[after.experienceBand] : 'Chưa chọn';
    changes.push(`Kinh nghiệm ${bLabel} → ${aLabel}`);
  }
  if (before.jobLevel !== after.jobLevel) {
    // (2) Cấp bậc là bất biến sau khi kích hoạt chiến dịch Săn → không ghi nhận là thay đổi.
  }
  if (before.location !== after.location) {
    changes.push(`Địa điểm: ${after.location || 'Toàn quốc'}`);
  }
  if (before.autonomyLevel !== after.autonomyLevel) {
    changes.push(`Mức tự chủ Mức ${before.autonomyLevel ?? '—'} → Mức ${after.autonomyLevel ?? '—'}`);
  }
  if (before.workEnvironments.join(',') !== after.workEnvironments.join(',')) {
    changes.push(`Môi trường làm việc (${after.workEnvironments.length} mục)`);
  }
  if (before.technicalWorkTypes.join(',') !== after.technicalWorkTypes.join(',')) {
    changes.push(`Công việc kỹ thuật (${after.technicalWorkTypes.length} nhóm)`);
  }
  if (
    before.languages.join(',') !== after.languages.join(',') ||
    before.driverLicenses.join(',') !== after.driverLicenses.join(',') ||
    before.travelAbility !== after.travelAbility ||
    before.shiftFlexibility !== after.shiftFlexibility
  ) {
    changes.push('Điều kiện phụ (Ngoại ngữ / Bằng lái / Ca kíp)');
  }
  return changes;
}

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function SourcingJdRevisionModal({
  open,
  onClose,
  campaignId,
  jobId,
  revisionsRemaining,
  allResults = [],
  onWorkspaceUpdated,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string | null;
  jobId: string | null;
  revisionsRemaining: number | null;
  allResults?: CandidateMatchView[];
  onWorkspaceUpdated: (ws: RecruiterSourcingWorkspace, msg: string) => void;
}) {
  const qc = useQueryClient();
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: Boolean(open && jobId),
  });

  const [salesForm, setSalesForm] = useState<JdSalesFormState>(emptyJdSalesForm);
  const [techForm, setTechForm] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [initialSales, setInitialSales] = useState<JdSalesFormState>(emptyJdSalesForm);
  const [initialTech, setInitialTech] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [showFullJd, setShowFullJd] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [errText, setErrText] = useState<string | null>(null);

  const isSales = job ? trackFromJob(job) === JobTrack.Sales : true;

  useEffect(() => {
    if (!open) {
      setConfirmDiscardOpen(false);
      setErrText(null);
      return;
    }
    if (!job || hydratedId === job.id) return;
    const s = jobViewToForm(job);
    const t = jobViewToTechnicalForm(job);
    setSalesForm(s);
    setTechForm(t);
    setInitialSales(s);
    setInitialTech(t);
    setHydratedId(job.id);
  }, [open, job, hydratedId]);

  const aiDiagnostics = useMemo(() => {
    const highCount = allResults.filter((r) => r.match.score >= 80).length;
    const medCount = allResults.filter((r) => {
      const p = r.match.score;
      return p >= 60 && p < 80;
    }).length;
    const missingCounts = new Map<string, number>();
    for (const r of allResults) {
      for (const m of r.match.missingSkills ?? []) {
        missingCounts.set(m, (missingCounts.get(m) ?? 0) + 1);
      }
    }
    const topMissing = [...missingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count} UV)`);

    return { highCount, medCount, totalCount: allResults.length, topMissing };
  }, [allResults]);

  const diffItems = useMemo(
    () => (isSales ? buildSalesDiffNotes(initialSales, salesForm) : buildTechDiffNotes(initialTech, techForm)),
    [isSales, initialSales, salesForm, initialTech, techForm],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (diffItems.length > 0) return true;
    return isSales
      ? JSON.stringify(salesForm) !== JSON.stringify(initialSales)
      : JSON.stringify(techForm) !== JSON.stringify(initialTech);
  }, [diffItems.length, isSales, salesForm, initialSales, techForm, initialTech]);

  const handleRequestClose = () => {
    if (reviseMutation.isPending) return;
    if (hasUnsavedChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    setSalesForm(initialSales);
    setTechForm(initialTech);
    setConfirmDiscardOpen(false);
    setErrText(null);
    onClose();
  };

  const currentExp = isSales ? salesForm.experienceBand : techForm.experienceBand;
  const relaxedExp = currentExp ? EXP_RELAX_MAP[currentExp] : undefined;

  const currentSalaryMax = Number(isSales ? salesForm.salaryMax : techForm.salaryMax) || 0;
  const currentSalaryMin = Number(isSales ? salesForm.salaryMin : techForm.salaryMin) || 0;
  const boostedSalaryMax =
    currentSalaryMax > 0
      ? Math.round((currentSalaryMax * 1.2) / 500_000) * 500_000
      : currentSalaryMin > 0
        ? Math.round((currentSalaryMin * 1.3) / 500_000) * 500_000
        : 22_000_000;

  const applyRelaxExperience = () => {
    const nextBand = relaxedExp ?? ExperienceBand.From1To3;
    if (isSales) {
      setSalesForm((prev) => ({ ...prev, experienceBand: nextBand }));
    } else {
      setTechForm((prev) => ({ ...prev, experienceBand: nextBand }));
    }
  };

  const applyBoostSalary = () => {
    const nextMax = String(boostedSalaryMax);
    if (isSales) {
      setSalesForm((prev) => ({ ...prev, salaryMax: nextMax }));
    } else {
      setTechForm((prev) => ({ ...prev, salaryMax: nextMax }));
    }
  };

  const applyRelaxAuxiliary = () => {
    if (isSales) {
      setSalesForm((prev) => ({
        ...prev,
        industryHardMode: 'off',
        driverLicenses: [],
        travelAbility: '',
      }));
    } else {
      setTechForm((prev) => ({
        ...prev,
        autonomyLevel: prev.autonomyLevel && prev.autonomyLevel > 2 ? prev.autonomyLevel - 1 : prev.autonomyLevel,
        driverLicenses: [],
        shiftFlexibility: '',
      }));
    }
  };

  const reviseMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !campaignId) throw new Error('Chưa có JD gắn với Tin Săn này');
      // (2) Vị trí & Cấp bậc là bất biến sau khi kích hoạt chiến dịch Săn.
      // Gửi kèm giá trị GỐC (không phải giá trị trong form) để backend luôn khớp.
      if (isSales) {
        const { publish: _publish, ...payload } = formToCreateJobRequest(salesForm, false);
        await updateJob(jobId, {
          ...payload,
          title: initialSales.title || payload.title,
          jobLevel: initialSales.jobLevel || undefined,
          fromSourcingRevision: true,
        });
      } else {
        const { publish: _publish, ...payload } = formToCreateTechnicalJobRequest(techForm, false);
        await updateJob(jobId, {
          ...payload,
          title: initialTech.title || payload.title,
          jobLevel: initialTech.jobLevel || undefined,
          technicalCriteria: {
            ...(payload.technicalCriteria ?? ({} as JobTechnicalCriteria)),
            position: initialTech.position || payload.technicalCriteria?.position || null,
          },
          fromSourcingRevision: true,
        });
      }
      const changeSummary =
        diffItems.length > 0
          ? diffItems.join('; ')
          : 'Cập nhật mô tả & tối ưu trọng số tiêu chí JD';
      const updatedWs = await consumeRecruiterSourcing({
        kind: 'revision',
        campaignId: campaignId,
        jobId,
        note: `Điều chỉnh Tin Săn «${isSales ? salesForm.title : techForm.title}»: ${changeSummary}`,
      });
      return { updatedWs, changeSummary };
    },
    onSuccess: ({ updatedWs, changeSummary }) => {
      setErrText(null);
      setConfirmDiscardOpen(false);
      setInitialSales(salesForm);
      setInitialTech(techForm);
      // Tự động đóng popup ngay lập tức khi NTD bấm Lưu thành công
      onClose();
      onWorkspaceUpdated(
        updatedWs,
        `Đã áp dụng điều chỉnh (${changeSummary}) và đang cập nhật đợt quét ứng viên mới!`,
      );
      void qc.invalidateQueries({ queryKey: ['job', jobId] });
      void qc.invalidateQueries({ queryKey: ['my-jobs'] });
      if (jobId) {
        void sourcingCandidatesForJob(jobId, true).then(() => {
          void qc.invalidateQueries({ queryKey: ['sourcing-hunt', jobId] });
          void qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
        });
      }
    },
    onError: (err) => {
      setErrText(err instanceof ApiError ? err.message : 'Không lưu được điều chỉnh tiêu chí JD');
    },
  });

  if (!open) return null;

  const outOfRevisions = revisionsRemaining !== null && revisionsRemaining <= 0;
  const lockedDisabled = reviseMutation.isPending || outOfRevisions;
  const fixedTitle = isSales ? salesForm.title : techForm.position || techForm.title;
  const fixedLevelCode = (isSales ? salesForm.jobLevel : techForm.jobLevel) || job?.jobLevel || '';
  const fixedLevelLabel = fixedLevelCode
    ? ((JOB_LEVEL_LABEL as Record<string, string>)[fixedLevelCode] ?? fixedLevelCode)
    : 'Chưa chọn';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-5"
      onClick={handleRequestClose}
    >
      {/* Khung Modal bo tròn 4 góc đều nhau (overflow-hidden giữ bo góc không bị thanh cuộn cắt mất) */}
      <div
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* HEADER CỐ ĐỊNH + NÚT X GÓC PHẢI DỄ BẤM */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#E8872A] ring-1 ring-amber-200">
                <Sparkles className="h-3 w-3" />
                Tối ưu tiêu chí tuyển dụng
              </span>
              <span className="inline-flex items-center rounded-full bg-[#072348] px-2.5 py-0.5 text-[10px] font-bold text-white">
                Còn {revisionsRemaining ?? '∞'} lượt điều chỉnh
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-extrabold text-[#072348] sm:text-xl">
              Điều chỉnh tiêu chí Tin Săn
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Chọn gợi ý tối ưu từ AI hoặc chỉnh sửa trực tiếp các nhóm tiêu chí tuyển dụng bên dưới — hệ thống tự động
              ghi nhận lịch sử và quét lại ứng viên ngay.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            title="Đóng cửa sổ điều chỉnh"
            aria-label="Đóng cửa sổ điều chỉnh"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN BÊN TRONG */}
        {!jobId ? (
          <div className="p-6">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              Tin Săn này chưa gắn JD. Hãy tạo hoặc gắn JD trước khi điều chỉnh tiêu chí.
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#E8872A]" /> Đang tải tiêu chí JD hiện tại...
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f4f7fb]/60 px-5 py-4 sm:px-6 sm:py-5">
            {/* Thanh "Thông tin cố định của chiến dịch" — read-only, có icon 🔒 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-100/70 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  Thông tin cố định của chiến dịch
                </p>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-[#E8872A] ring-1 ring-amber-200/80">
                  {isSales ? 'Khối Kinh doanh B2B' : 'Khối Kỹ thuật & Công nghiệp'}
                </span>
              </div>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-500">Vị trí tuyển dụng</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-[#072348]">
                    <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                    {fixedTitle || job?.title || 'Chưa có'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-500">Cấp bậc</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-[#072348]">
                    <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                    {fixedLevelLabel}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Vị trí và cấp bậc được cố định theo gói Tin săn sau khi đăng để đảm bảo đúng phạm vi chiến dịch.
              </p>
            </div>

            {/* PHẦN 1: ĐỀ XUẤT ĐIỀU CHỈNH TỰ ĐỘNG TỪ AI INLINK (1-CLICK ÁP DỤNG) */}
            <div className="rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#072348] sm:text-sm">
                  <Sparkles className="h-4 w-4 text-[#E8872A]" />
                  Gợi ý tối ưu tiêu chí từ AI inlink
                </h4>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                  {aiDiagnostics.highCount} UV khớp ≥80% · {aiDiagnostics.medCount} UV tiệm cận 60–79%
                </span>
              </div>
              {aiDiagnostics.topMissing.length > 0 ? (
                <p className="mt-1 text-xs text-slate-600">
                  Điểm nghẽn tiêu chí phổ biến nhất:{' '}
                  <span className="font-semibold text-[#072348]">{aiDiagnostics.topMissing.join(' · ')}</span>
                </p>
              ) : null}

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {/* Gợi ý 1: Nới kinh nghiệm */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">1. Nới bậc kinh nghiệm (-1 bậc)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Hạ yêu cầu từ{' '}
                      <span className="font-semibold text-slate-800">
                        {currentExp ? EXPERIENCE_LABEL[currentExp] : 'Mức hiện tại'}
                      </span>{' '}
                      xuống{' '}
                      <span className="font-semibold text-[#E8872A]">
                        {relaxedExp ? EXPERIENCE_LABEL[relaxedExp] : EXPERIENCE_LABEL[ExperienceBand.From1To3]}
                      </span>{' '}
                      để đẩy nhóm UV 65–79% lên ngưỡng ≥80%.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled || currentExp === ExperienceBand.None}
                    onClick={applyRelaxExperience}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <Sparkles className="h-3 w-3 text-[#E8872A]" />
                    {currentExp === ExperienceBand.None ? 'Đã mở rộng tối đa' : 'Áp dụng nới kinh nghiệm'}
                  </button>
                </div>

                {/* Gợi ý 2: Nâng trần ngân sách lương +20% */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">2. Nâng trần ngân sách (+20%)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Nâng trần lương tối đa lên{' '}
                      <span className="font-semibold text-[#E8872A]">{formatVndAmount(boostedSalaryMax)}</span> để thu
                      hút nhóm ứng viên Senior/Key Account.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled}
                    onClick={applyBoostSalary}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <TrendingUp className="h-3 w-3 text-[#E8872A]" />
                    Áp dụng nâng trần +20%
                  </button>
                </div>

                {/* Gợi ý 3: Nới lọc cứng & điều kiện phụ */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">3. Mở rộng ngành & điều kiện phụ</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      {isSales
                        ? 'Tắt lọc cứng ngành tuyệt đối và gỡ yêu cầu bắt buộc bằng lái/công tác để mở rộng tệp B2B.'
                        : 'Giảm 1 bậc tự chủ yêu cầu và gỡ điều kiện bắt buộc bằng lái/ca kíp để mở rộng tệp kỹ sư.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled}
                    onClick={applyRelaxAuxiliary}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <RefreshCw className="h-3 w-3 text-[#E8872A]" />
                    Áp dụng mở rộng tệp săn
                  </button>
                </div>
              </div>
            </div>

            {/* TIÊU CHÍ TUYỂN DỤNG TRỌNG TÂM */}
            <fieldset disabled={lockedDisabled} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1 px-0.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348] sm:text-sm">
                  Tiêu chí tuyển dụng & Độ phủ ứng viên
                </h4>
                <span className="text-[11px] text-slate-500">
                  Chỉnh sửa trực tiếp các tiêu chí quyết định độ phù hợp hồ sơ
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {/* MỨC THU NHẬP & NGÂN SÁCH LƯƠNG */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Mức thu nhập & Ngân sách lương (VNĐ/tháng)
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Quyết định trực tiếp điểm khớp thu nhập kỳ vọng của ứng viên.
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Lương tối thiểu</label>
                      <MoneyInput
                        value={isSales ? salesForm.salaryMin : techForm.salaryMin}
                        onChange={(salaryMin) =>
                          isSales
                            ? setSalesForm((p) => ({ ...p, salaryMin }))
                            : setTechForm((p) => ({ ...p, salaryMin }))
                        }
                        placeholder="VD: 15.000.000"
                        size="sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Trần ngân sách tối đa</label>
                      <MoneyInput
                        value={isSales ? salesForm.salaryMax : techForm.salaryMax}
                        onChange={(salaryMax) =>
                          isSales
                            ? setSalesForm((p) => ({ ...p, salaryMax }))
                            : setTechForm((p) => ({ ...p, salaryMax }))
                        }
                        placeholder="VD: 25.000.000"
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* KINH NGHIỆM YÊU CẦU — cấp bậc đã khóa ở thanh "Thông tin cố định" */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Kinh nghiệm yêu cầu
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Điều chỉnh độ mở về thâm niên để cân bằng giữa chất lượng và độ rộng tệp hồ sơ.
                  </p>
                  <div className="mt-3 space-y-2">
                    {/* Cấp bậc: hiển thị read-only kèm 🔒 — KHÔNG cho mở dropdown. */}
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                      <span className="text-[11px] font-semibold text-slate-500">Cấp bậc (đã khóa)</span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <Lock className="h-3 w-3 text-slate-400" />
                        {fixedLevelLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(ExperienceBand).map((band) => {
                        const active = (isSales ? salesForm.experienceBand : techForm.experienceBand) === band;
                        return (
                          <button
                            key={band}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, experienceBand: band }))
                                : setTechForm((p) => ({ ...p, experienceBand: band }))
                            }
                            className={clsx(
                              'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white',
                            )}
                          >
                            {EXPERIENCE_LABEL[band]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* KHU VỰC LÀM VIỆC & THỊ TRƯỜNG PHỤ TRÁCH */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Khu vực làm việc & Địa bàn phụ trách
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Thêm các tỉnh/KCN lân cận để bắt trọn ứng viên sẵn sàng di chuyển hoặc phụ trách vùng.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <LocationPicker
                      variant="field"
                      multiple
                      placeholder="Chọn tỉnh / thành phố / KCN..."
                      value={parseJoinedLocations(isSales ? salesForm.location : techForm.location)}
                      onChange={(labels) => {
                        const location = joinLocationLabels(labels);
                        if (isSales) setSalesForm((p) => ({ ...p, location }));
                        else setTechForm((p) => ({ ...p, location }));
                      }}
                    />
                    {isSales ? (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Thị trường phụ trách:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MARKET_REGIONS.map((m) => {
                            const active = salesForm.marketsCovered.includes(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    marketsCovered: toggleArrayItem(p.marketsCovered, m),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Môi trường làm việc:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {WORK_ENVIRONMENT_OPTIONS.map((env) => {
                            const active = techForm.workEnvironments.includes(env);
                            return (
                              <button
                                key={env}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({
                                    ...p,
                                    workEnvironments: toggleArrayItem(p.workEnvironments, env),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {env}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIÊU CHÍ CHUYÊN MÔN TRỌNG TÂM */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Yêu cầu chuyên môn trọng tâm
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {isSales
                      ? 'Chế độ lọc ngành, tệp khách hàng mục tiêu và mô hình bán hàng.'
                      : 'Mức độ tự chủ công việc (1–5) và nhóm nghiệp vụ kỹ thuật.'}
                  </p>
                  {isSales ? (
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Chế độ lọc cứng ngành:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ['off', 'Không lọc cứng (Mở rộng)'],
                              ['near', 'Ngành gần (≥85%)'],
                              ['exact', 'Đúng ngành (100%)'],
                            ] as const
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSalesForm((p) => ({ ...p, industryHardMode: val }))}
                              className={clsx(
                                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                                salesForm.industryHardMode === val
                                  ? 'border-[#072348] bg-[#072348] text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Tệp khách hàng B2B:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CUSTOMER_SEGMENTS.map((seg) => {
                            const active = salesForm.customerSegments.includes(seg);
                            return (
                              <button
                                key={seg}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    customerSegments: toggleArrayItem(p.customerSegments, seg),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#E8872A] bg-amber-50 font-bold text-[#072348]'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {seg}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Loại hình bán hàng:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DEAL_TYPE_OPTIONS.map((dt) => {
                            const active = salesForm.dealTypes.includes(dt);
                            return (
                              <button
                                key={dt}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    dealTypes: toggleArrayItem(p.dealTypes, dt),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {DEAL_TYPE_LABEL[dt]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Mức độ tự chủ kỹ thuật (1–5):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {JD_TECHNICAL_AUTONOMY_OPTIONS.map((opt) => {
                            const active = techForm.autonomyLevel === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setTechForm((p) => ({ ...p, autonomyLevel: opt.value }))}
                                className={clsx(
                                  'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                                )}
                              >
                                {opt.value}. {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Nhóm công việc kỹ thuật:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TECHNICAL_WORK_TYPES.map((wt) => {
                            const active = techForm.technicalWorkTypes.includes(wt);
                            return (
                              <button
                                key={wt}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({
                                    ...p,
                                    technicalWorkTypes: toggleArrayItem(p.technicalWorkTypes, wt),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#E8872A] bg-amber-50 font-bold text-[#072348]'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {wt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ĐIỀU KIỆN BỔ TRỢ */}
              <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                  Điều kiện bổ trợ (Ngoại ngữ · Giấy phép lái xe · Công tác)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Bỏ bớt các điều kiện phụ không thực sự bắt buộc sẽ giúp tăng đáng kể điểm tổng cho ứng viên giỏi
                  chuyên môn.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Ngoại ngữ:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGE_OPTIONS.map((lang) => {
                        const list = isSales ? salesForm.languages : techForm.languages;
                        const active = list.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, languages: toggleArrayItem(p.languages, lang) }))
                                : setTechForm((p) => ({ ...p, languages: toggleArrayItem(p.languages, lang) }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Giấy phép lái xe:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DRIVER_LICENSE_TYPES.map((lic) => {
                        const list = isSales ? salesForm.driverLicenses : techForm.driverLicenses;
                        const active = list.includes(lic);
                        return (
                          <button
                            key={lic}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({
                                    ...p,
                                    driverLicenses: toggleArrayItem(p.driverLicenses, lic),
                                  }))
                                : setTechForm((p) => ({
                                    ...p,
                                    driverLicenses: toggleArrayItem(p.driverLicenses, lic),
                                  }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {lic}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Khả năng đi công tác:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(TravelAbility).map((tr) => {
                        const current = isSales ? salesForm.travelAbility : techForm.travelAbility;
                        const active = current === tr;
                        return (
                          <button
                            key={tr}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, travelAbility: active ? '' : tr }))
                                : setTechForm((p) => ({ ...p, travelAbility: active ? '' : tr }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {TRAVEL_ABILITY_LABEL[tr]}
                          </button>
                        );
                      })}
                    </div>
                    {!isSales ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Làm ca / ngoài giờ:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {JD_TECHNICAL_SHIFT_OPTIONS.map((sh) => {
                            const active = techForm.shiftFlexibility === sh.value;
                            return (
                              <button
                                key={sh.value}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({ ...p, shiftFlexibility: active ? '' : sh.value }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {sh.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Nút mở rộng chỉnh sửa toàn bộ JD chi tiết (vẫn khóa Vị trí tuyển dụng) */}
            <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#072348]">
                    Chỉnh sửa nâng cao: Danh mục Sản phẩm/Thiết bị & Nội dung mô tả JD
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Mở biểu mẫu đầy đủ nếu muốn cập nhật thêm thiết bị/sản phẩm, chứng chỉ hoặc mô tả công việc (Vị trí
                    gốc vẫn khóa cố định).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullJd((v) => !v)}
                  className="rounded-xl border border-[#072348]/20 bg-[#f4f7fb] px-3 py-1.5 text-xs font-bold text-[#072348] transition hover:bg-[#072348] hover:text-white"
                >
                  {showFullJd ? 'Thu gọn biểu mẫu đầy đủ' : 'Mở biểu mẫu JD chi tiết'}
                </button>
              </div>
              {showFullJd ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {isSales ? (
                    <JdSalesForm
                      form={salesForm}
                      lockPosition
                      onChange={(partial) => setSalesForm((prev) => ({ ...prev, ...partial }))}
                      uncertainKeys={[]}
                      disabled={lockedDisabled}
                    />
                  ) : (
                    <JdTechnicalForm
                      form={techForm}
                      lockPosition
                      onChange={(partial) => setTechForm((prev) => ({ ...prev, ...partial }))}
                      uncertainKeys={[]}
                      disabled={lockedDisabled}
                    />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* FOOTER CỐ ĐỊNH GỌN GÀNG + NHẬT KÝ THAY ĐỔI */}
        {jobId && !isLoading ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
            {errText ? (
              <p className="mb-2.5 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errText}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {diffItems.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#072348]">Thay đổi chờ áp dụng:</span>
                    {diffItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-[#072348] ring-1 ring-amber-200"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Chưa có thay đổi nào so với JD hiện tại. Bạn có thể chọn gợi ý tối ưu hoặc chỉnh sửa các tiêu chí ở
                    trên.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={handleRequestClose}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  disabled={lockedDisabled || !hasUnsavedChanges}
                  onClick={() => reviseMutation.mutate()}
                >
                  {reviseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu điều chỉnh & Quét lại ngay (-1 lượt)
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* HỘP THOẠI XÁC NHẬN KHI BẤM X / HUỶ MÀ CHƯA LƯU ĐIỀU CHỈNH */}
        {confirmDiscardOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[#E8872A]">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-base font-extrabold text-[#072348]">
                    Điều chỉnh chưa được áp dụng
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Bạn đã thay đổi tiêu chí săn nhưng chưa bấm lưu áp dụng. Bạn có muốn huỷ các điều chỉnh vừa thực
                    hiện không?
                  </p>
                  {diffItems.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {diffItems.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscardOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Tiếp tục điều chỉnh
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  Có, huỷ điều chỉnh
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
