'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CheckCircle2,
  Eye,
  FileEdit,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react';
import { ApplicationStatus, formatJobTitle, type ApplicantView } from '@industriallink/contracts';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { APPLICATION_STATUS_LABEL, PIPELINE_STEPS } from '@/lib/format';
import {
  broadcastJobEmail,
  suggestBroadcastEmail,
  type BroadcastEmailPurpose,
} from '@/lib/jobs';

const AI_PURPOSES: {
  id: BroadcastEmailPurpose;
  label: string;
  desc: string;
}[] = [
  { id: 'received', label: 'Xác nhận nhận CV', desc: 'Báo đã nhận hồ sơ & đang đối chiếu' },
  { id: 'screening', label: 'Qua sàng lọc', desc: 'Thông báo hồ sơ đang/đã qua vòng sàng lọc' },
  { id: 'interview', label: 'Chuẩn bị phỏng vấn', desc: 'Nhắc ứng viên chuẩn bị trước buổi PV' },
  { id: 'supplement', label: 'Bổ sung thông tin', desc: 'Đề nghị cập nhật thêm dự án / CV chi tiết' },
  { id: 'progress', label: 'Cập nhật tiến độ', desc: 'Thông báo tiến độ xử lý hồ sơ chung' },
  { id: 'keep', label: 'Thư cảm ơn / Giữ liên lạc', desc: 'Phản hồi lịch sự & lưu hồ sơ tiềm năng' },
];

const MERGE_TAGS = [
  { token: '{ten_ung_vien}', label: 'Tên ứng viên' },
  { token: '{vi_tri}', label: 'Vị trí tuyển dụng' },
  { token: '{cong_ty}', label: 'Tên công ty' },
] as const;

const STATUS_ORDER: ApplicationStatus[] = [
  ...PIPELINE_STEPS,
  ApplicationStatus.Rejected,
  ApplicationStatus.Withdrawn,
];

const STATUS_BADGE_TONE: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Applied]: 'bg-brand-50 text-brand-700 ring-brand-200',
  [ApplicationStatus.Screening]: 'bg-sky-50 text-sky-700 ring-sky-200',
  [ApplicationStatus.Interview]: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  [ApplicationStatus.Offer]: 'bg-amber-50 text-amber-800 ring-amber-200',
  [ApplicationStatus.Hired]: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  [ApplicationStatus.Rejected]: 'bg-rose-50 text-rose-700 ring-rose-200',
  [ApplicationStatus.Withdrawn]: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function normalizeMatchPct(score: number | null): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

function interpolatePreview(
  text: string,
  vars: { candidateName: string; jobTitle: string; companyName: string },
): string {
  return text
    .replace(/\{\{\s*ten_ung_vien\s*\}\}|\{\s*ten_ung_vien\s*\}|\{\s*candidate_name\s*\}/gi, vars.candidateName)
    .replace(/\{\{\s*vi_tri\s*\}\}|\{\s*vi_tri\s*\}|\{\s*job_title\s*\}/gi, vars.jobTitle)
    .replace(/\{\{\s*cong_ty\s*\}\}|\{\s*cong_ty\s*\}|\{\s*company_name\s*\}/gi, vars.companyName);
}

export function BroadcastEmailForm({
  jobId,
  jobTitle,
  companyName,
  applicants,
  onSent,
  onCancel,
}: {
  jobId: string;
  jobTitle?: string;
  companyName?: string;
  applicants: ApplicantView[];
  onSent?: (result: { recipients: number; sent: number; failed: number }) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [activePurpose, setActivePurpose] = useState<BroadcastEmailPurpose | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [highMatchOnly, setHighMatchOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [nextStatus, setNextStatus] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Tự động chọn tất cả ứng viên khi mới mở form hoặc đổi tin tuyển dụng để NTD thao tác nhanh
  useEffect(() => {
    if (applicants.length > 0) {
      setSelected(new Set(applicants.map((a) => a.applicationId)));
    } else {
      setSelected(new Set());
    }
  }, [jobId, applicants]);

  const groups = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      rows: applicants.filter((row) => row.status === status),
    })).filter((group) => group.rows.length > 0);
  }, [applicants]);

  const highMatchApplicantsCount = useMemo(
    () =>
      applicants.filter((r) => {
        const s = normalizeMatchPct(r.matchScore);
        return s != null && s >= 70;
      }).length,
    [applicants],
  );

  const filteredApplicants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applicants.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (highMatchOnly) {
        const s = normalizeMatchPct(row.matchScore);
        if (s == null || s < 70) return false;
      }
      if (q) {
        const nameMatch = row.displayName.toLowerCase().includes(q);
        const posMatch = (row.currentPosition ?? '').toLowerCase().includes(q);
        const indMatch = (row.industry ?? '').toLowerCase().includes(q);
        if (!nameMatch && !posMatch && !indMatch) return false;
      }
      return true;
    });
  }, [applicants, statusFilter, highMatchOnly, searchQuery]);

  const visibleIds = useMemo(
    () => filteredApplicants.map((row) => row.applicationId),
    [filteredApplicants],
  );
  const allVisibleChecked =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const suggestStatuses = useMemo(() => {
    const picked = applicants
      .filter((row) => selected.has(row.applicationId))
      .map((row) => row.status);
    if (picked.length > 0) return [...new Set(picked)];
    if (statusFilter !== 'all') return [statusFilter as ApplicationStatus];
    return [];
  }, [applicants, selected, statusFilter]);

  const suggestMutation = useMutation({
    mutationFn: (purpose: BroadcastEmailPurpose) => {
      setActivePurpose(purpose);
      return suggestBroadcastEmail(jobId, { purpose, statuses: suggestStatuses });
    },
    onSuccess: (draft) => {
      setSubject(draft.subject);
      setBody(draft.body);
      setActiveTab('compose');
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      broadcastJobEmail(jobId, {
        subject: subject.trim(),
        body: body.trim(),
        applicationIds: [...selected],
        ...(nextStatus ? { nextStatus: nextStatus as ApplicationStatus } : {}),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['applicants', jobId] });
      void queryClient.invalidateQueries({ queryKey: ['broadcast-email-history', jobId] });
      onSent?.(result);
    },
  });

  const canSend =
    subject.trim().length >= 3 && body.trim().length >= 10 && selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleIds(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function insertMergeTag(token: string) {
    setBody((prev) => {
      if (!prev) return token;
      const needsSpace = !prev.endsWith(' ') && !prev.endsWith('\n');
      return `${prev}${needsSpace ? ' ' : ''}${token}`;
    });
    setActiveTab('compose');
  }

  const previewCandidate = useMemo(() => {
    const firstSelected = applicants.find((a) => selected.has(a.applicationId));
    return firstSelected ?? applicants[0] ?? null;
  }, [applicants, selected]);

  const previewVars = {
    candidateName: previewCandidate?.displayName ?? 'Nguyễn Văn A',
    jobTitle: jobTitle ? formatJobTitle(jobTitle) : 'Vị trí đang ứng tuyển',
    companyName: companyName ?? 'Quý Công ty',
  };

  const resolvedPreviewSubject = interpolatePreview(
    subject.trim() || 'Cập nhật quy trình tuyển dụng',
    previewVars,
  );
  const resolvedPreviewBody = interpolatePreview(
    body.trim() ||
      'Cảm ơn bạn đã quan tâm tới cơ hội nghề nghiệp tại doanh nghiệp. Hồ sơ của bạn đang được bộ phận Tuyển dụng xem xét theo quy trình...',
    previewVars,
  ).replace(/^xin\s+chào[^,\n]*[,:]?\s*\n*/i, '');

  return (
    <div>
      {/* Header khu vực soạn thảo */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Mail className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-brand-800">
              Soạn & Gửi Email cá nhân hóa hàng loạt
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Mỗi ứng viên nhận một thư riêng biệt có lời chào tên riêng, gắn thương hiệu công ty và tên vị trí tuyển dụng.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition',
              activeTab === 'compose'
                ? 'bg-white text-brand-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <FileEdit className="h-3.5 w-3.5" />
            Soạn thảo nội dung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition',
              activeTab === 'preview'
                ? 'bg-white text-brand-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <Eye className="h-3.5 w-3.5 text-[#E8872A]" />
            Xem trước thư gửi đi
          </button>
        </div>
      </div>

      {/* Bố cục 2 cột chính */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        {/* CỘT TRÁI: SOẠN THẢO HOẶC XEM TRƯỚC */}
        <div className="space-y-4">
          {/* Kịch bản AI & Mẫu soạn nhanh */}
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <Sparkles className="h-4 w-4 text-[#E8872A]" />
                Chọn kịch bản để AI tự động soạn thư chuẩn HR
              </p>
              {suggestMutation.isPending ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Đang soạn thảo...
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              AI tự động điều chỉnh giọng văn sát với vị trí tuyển dụng và trạng thái ứng viên đang chọn.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {AI_PURPOSES.map((item) => {
                const isCurrent = activePurpose === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={mutation.isPending || suggestMutation.isPending}
                    onClick={() => suggestMutation.mutate(item.id)}
                    className={clsx(
                      'flex flex-col items-start rounded-xl border px-3 py-2 text-left transition duration-150 active:scale-[0.98] disabled:opacity-50',
                      isCurrent
                        ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                        : 'border-amber-200/90 bg-white text-slate-800 hover:border-amber-400 hover:bg-amber-50/60',
                    )}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span
                      className={clsx(
                        'mt-0.5 line-clamp-1 text-[10px]',
                        isCurrent ? 'text-white/80' : 'text-slate-500',
                      )}
                    >
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            {suggestMutation.isError && (
              <p className="mt-2 text-xs text-red-600">
                {suggestMutation.error instanceof ApiError
                  ? suggestMutation.error.message
                  : 'Không soạn được gợi ý'}
              </p>
            )}
          </div>

          {activeTab === 'compose' ? (
            <div className="space-y-3.5">
              <Field label="Tiêu đề email *">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="VD: Thông báo kết quả sàng lọc hồ sơ vị trí {vi_tri}"
                  disabled={mutation.isPending}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Hệ thống tự động gắn tiền tố <strong className="text-slate-600">[{previewVars.companyName}]</strong> ở đầu tiêu đề khi gửi.
                </p>
              </Field>

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Nội dung thư *
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Tag className="h-3 w-3 text-brand-600" />
                      Chèn biến:
                    </span>
                    {MERGE_TAGS.map((tag) => (
                      <button
                        key={tag.token}
                        type="button"
                        onClick={() => insertMergeTag(tag.token)}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-slate-200/80 transition hover:bg-brand-50 hover:ring-brand-300"
                        title={`Chèn biến ${tag.label}`}
                      >
                        + {tag.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khung nhắc cấu trúc đầu/cuối thư tự động để NTD không gõ lặp */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15">
                  <div className="border-b border-dashed border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-500">
                    Lời chào tự động:{' '}
                    <strong className="text-slate-800">
                      Xin chào {'{Tên riêng từng ứng viên}'},
                    </strong>
                  </div>
                  <Textarea
                    rows={9}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Nhập nội dung thông báo tới ứng viên (không cần gõ lại câu Xin chào ở đầu)..."
                    disabled={mutation.isPending || suggestMutation.isPending}
                    className="border-0 focus:ring-0 rounded-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 bg-slate-50/80 px-3.5 py-2 text-[11px] text-slate-500">
                    <span>
                      Chữ ký tự động:{' '}
                      <strong className="text-slate-700">
                        — {previewVars.companyName} · {previewVars.jobTitle}
                      </strong>
                    </span>
                    <span>{body.trim().length} / 2000 ký tự</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB XEM TRƯỚC EMAIL THỰC TẾ */
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-600">
                  Xem trước với ứng viên mẫu:{' '}
                  <strong className="text-brand-800">{previewVars.candidateName}</strong>
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                  Tiêu đề: [{previewVars.companyName}] {resolvedPreviewSubject}
                </span>
              </div>

              <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b-[3px] border-[#E8872A] bg-gradient-to-br from-[#072348] to-[#0f386e] px-6 py-5 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400">
                    inlink · Thông báo Tuyển dụng
                  </p>
                  <p className="mt-1.5 text-lg font-bold leading-snug">
                    {resolvedPreviewSubject}
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    {previewVars.companyName} · Vị trí: {previewVars.jobTitle}
                  </p>
                </div>
                <div className="p-6 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    Xin chào <strong>{previewVars.candidateName}</strong>,
                  </p>
                  <div className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">
                    {resolvedPreviewBody}
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-3.5 text-xs text-slate-500">
                    <strong className="text-brand-800">{previewVars.companyName}</strong>
                    <br />
                    <span>Chiến dịch tuyển dụng: {previewVars.jobTitle}</span>
                  </div>
                  <div className="mt-4">
                    <span className="inline-block rounded-lg bg-[#072348] px-4 py-2 text-xs font-semibold text-white">
                      Xem trạng thái hồ sơ trên inlink →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: DANH SÁCH & BỘ LỌC NGƯỜI NHẬN */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            {/* Tiêu đề & số lượng đã chọn */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-700" />
                <p className="text-sm font-bold text-brand-800">Danh sách Người nhận</p>
              </div>
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
                  selected.size > 0
                    ? 'bg-brand-700 text-white'
                    : 'bg-slate-200 text-slate-600',
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Đã chọn {selected.size} / {applicants.length} ứng viên
              </span>
            </div>

            {/* Ô tìm kiếm nhanh ứng viên */}
            {applicants.length > 0 ? (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, chức danh hoặc ngành nghề..."
                  className="h-8.5 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none"
                />
              </div>
            ) : null}

            {/* Hàng Chip lọc theo trạng thái & độ khớp cao */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <StatusChip
                active={statusFilter === 'all' && !highMatchOnly}
                onClick={() => {
                  setStatusFilter('all');
                  setHighMatchOnly(false);
                }}
              >
                Tất cả ({applicants.length})
              </StatusChip>
              {highMatchApplicantsCount > 0 ? (
                <StatusChip
                  active={highMatchOnly}
                  onClick={() => setHighMatchOnly((prev) => !prev)}
                >
                  ★ Khớp ≥70% ({highMatchApplicantsCount})
                </StatusChip>
              ) : null}
              {groups.map((group) => (
                <StatusChip
                  key={group.status}
                  active={statusFilter === group.status}
                  onClick={() => setStatusFilter(group.status)}
                >
                  {APPLICATION_STATUS_LABEL[group.status]} ({group.rows.length})
                </StatusChip>
              ))}
            </div>

            {applicants.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Tin này chưa có ứng viên nộp hồ sơ
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Hãy chọn tin tuyển dụng khác hoặc chuyển sang mục Săn nhân sự để mời ứng viên.
                </p>
              </div>
            ) : (
              <>
                {/* Thanh thao tác chọn gọn gàng 1 dòng duy nhất */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/80">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={allVisibleChecked}
                      disabled={mutation.isPending || visibleIds.length === 0}
                      onChange={(e) => toggleIds(visibleIds, e.target.checked)}
                    />
                    Chọn tất cả đang lọc ({filteredApplicants.length})
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    {selected.size > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelected(new Set())}
                        className="font-semibold text-slate-500 hover:text-rose-600"
                      >
                        Bỏ chọn hết
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Danh sách thẻ ứng viên giàu thông tin */}
                <ul className="mt-2.5 max-h-[380px] space-y-2 overflow-y-auto pr-1">
                  {filteredApplicants.length === 0 ? (
                    <li className="rounded-xl bg-white p-6 text-center text-xs text-slate-500">
                      Không có ứng viên nào khớp với bộ lọc hiện tại.
                    </li>
                  ) : (
                    filteredApplicants.map((row) => {
                      const isChecked = selected.has(row.applicationId);
                      const scorePct = normalizeMatchPct(row.matchScore);
                      const createdDate = new Date(row.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      });

                      return (
                        <li key={row.applicationId}>
                          <label
                            className={clsx(
                              'flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition duration-150',
                              isChecked
                                ? 'bg-white ring-2 ring-brand-600 shadow-2xs'
                                : 'bg-white/80 ring-1 ring-slate-200 hover:bg-white hover:ring-slate-300',
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                checked={isChecked}
                                disabled={mutation.isPending}
                                onChange={() => toggleOne(row.applicationId)}
                              />
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                                {row.displayName.trim().charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-xs sm:text-[13px] font-bold text-slate-900">
                                    {row.displayName}
                                  </span>
                                  <span
                                    className={clsx(
                                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                                      STATUS_BADGE_TONE[row.status] ??
                                        'bg-slate-100 text-slate-600 ring-slate-200',
                                    )}
                                  >
                                    {APPLICATION_STATUS_LABEL[row.status]}
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                  {row.currentPosition
                                    ? formatJobTitle(row.currentPosition)
                                    : 'Chưa cập nhật chức danh'}
                                  {row.industry ? ` · ${row.industry}` : ''} · Nộp {createdDate}
                                </p>
                              </div>
                            </div>

                            {scorePct != null ? (
                              <span
                                className={clsx(
                                  'shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums',
                                  scorePct >= 70
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                    : scorePct >= 45
                                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                      : 'bg-slate-100 text-slate-600',
                                )}
                              >
                                {scorePct}%
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>

          {/* Tùy chọn tự động cập nhật trạng thái hồ sơ sau khi gửi */}
          <div className="mt-4 border-t border-slate-200/80 pt-3">
            <label className="block text-[11px] font-semibold text-slate-600">
              Cập nhật trạng thái hồ sơ sau khi gửi thư (Tùy chọn):
            </label>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              disabled={mutation.isPending}
              className="mt-1 h-8.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
            >
              <option value="">Giữ nguyên trạng thái hồ sơ hiện tại</option>
              <option value={ApplicationStatus.Screening}>
                Chuyển các hồ sơ đã nhận thư sang → Đang sàng lọc
              </option>
              <option value={ApplicationStatus.Interview}>
                Chuyển các hồ sơ đã nhận thư sang → Phỏng vấn
              </option>
              <option value={ApplicationStatus.Rejected}>
                Chuyển các hồ sơ đã nhận thư sang → Từ chối
              </option>
            </select>
          </div>
        </div>
      </div>

      {mutation.isError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : 'Không gửi được email hàng loạt'}
        </p>
      )}

      {/* Thanh tác vụ dưới cùng */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>
            Mỗi ứng viên sẽ nhận riêng 1 email cá nhân hóa và tự động ghi vào Nhật ký xử lý hồ sơ.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              Huỷ
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setActiveTab((prev) => (prev === 'compose' ? 'preview' : 'compose'))
            }
            disabled={mutation.isPending}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {activeTab === 'compose' ? 'Xem trước thư' : 'Quay lại sửa'}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || suggestMutation.isPending || !canSend}
            onClick={() => mutation.mutate()}
          >
            <Send className="mr-1.5 h-4 w-4" />
            {mutation.isPending
              ? 'Đang gửi email...'
              : `Gửi ngay cho ${selected.size} ứng viên`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition',
        active
          ? 'bg-brand-600 text-white shadow-2xs'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

export function BroadcastEmailModal({
  jobId,
  applicants,
  onClose,
  onSent,
}: {
  jobId: string;
  applicants: ApplicantView[];
  onClose: () => void;
  onSent?: (result: { recipients: number; sent: number; failed: number }) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <BroadcastEmailForm
          jobId={jobId}
          applicants={applicants}
          onCancel={onClose}
          onSent={(result) => {
            onSent?.(result);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
