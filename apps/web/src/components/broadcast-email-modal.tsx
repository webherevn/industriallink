'use client';

import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { ApplicationStatus, formatJobTitle, type ApplicantView } from '@industriallink/contracts';
import { useMemo, useState } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { APPLICATION_STATUS_LABEL, PIPELINE_STEPS } from '@/lib/format';
import { broadcastJobEmail, suggestBroadcastEmail } from '@/lib/jobs';

const AI_PURPOSES = [
  { id: 'progress', label: 'Cập nhật tiến độ' },
  { id: 'screening', label: 'Sau sàng lọc' },
  { id: 'interview', label: 'Chuẩn bị phỏng vấn' },
  { id: 'keep', label: 'Giữ liên lạc' },
] as const;

const STATUS_ORDER: ApplicationStatus[] = [
  ...PIPELINE_STEPS,
  ApplicationStatus.Rejected,
  ApplicationStatus.Withdrawn,
];

export function BroadcastEmailForm({
  jobId,
  applicants,
  onSent,
  onCancel,
}: {
  jobId: string;
  applicants: ApplicantView[];
  onSent?: (result: { recipients: number; sent: number; failed: number }) => void;
  onCancel?: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      rows: applicants.filter((row) => row.status === status),
    })).filter((group) => group.rows.length > 0);
  }, [applicants]);

  const visibleGroups = statusFilter === 'all' ? groups : groups.filter((group) => group.status === statusFilter);
  const visibleIds = visibleGroups.flatMap((group) => group.rows.map((row) => row.applicationId));
  const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const suggestStatuses = useMemo(() => {
    const picked = applicants.filter((row) => selected.has(row.applicationId)).map((row) => row.status);
    if (picked.length > 0) return [...new Set(picked)];
    if (statusFilter !== 'all') return [statusFilter as ApplicationStatus];
    return [];
  }, [applicants, selected, statusFilter]);

  const suggestMutation = useMutation({
    mutationFn: (purpose: (typeof AI_PURPOSES)[number]['id']) =>
      suggestBroadcastEmail(jobId, { purpose, statuses: suggestStatuses }),
    onSuccess: (draft) => {
      setSubject(draft.subject);
      setBody(draft.body);
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      broadcastJobEmail(jobId, {
        subject: subject.trim(),
        body: body.trim(),
        applicationIds: [...selected],
      }),
    onSuccess: (result) => {
      setSelected(new Set());
      onSent?.(result);
    },
  });

  const canSend = subject.trim().length >= 3 && body.trim().length >= 10 && selected.size > 0;

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

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Soạn email hàng loạt</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        Tick ứng viên theo trạng thái hồ sơ. Mỗi người nhận một thư riêng, kèm tên công ty và tên tin. Thư không đổi bước tuyển dụng: mời phỏng vấn, đề nghị và nhận việc vẫn làm ở đúng bước.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Field label="Tiêu đề *">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Cập nhật quy trình tuyển dụng"
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Nội dung *">
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Xin chào,&#10;&#10;Chúng tôi muốn thông báo…"
              disabled={mutation.isPending || suggestMutation.isPending}
            />
          </Field>
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Gợi ý AI
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              AI soạn theo tin và trạng thái đang chọn hoặc đang lọc. Không bịa lịch, lương hay tên người. Bạn đọc lại rồi gửi.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AI_PURPOSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={mutation.isPending || suggestMutation.isPending}
                  onClick={() => suggestMutation.mutate(item.id)}
                  className="rounded-full bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100 disabled:opacity-50"
                >
                  {suggestMutation.isPending ? 'Đang soạn...' : item.label}
                </button>
              ))}
            </div>
            {suggestMutation.isError && (
              <p className="mt-2 text-sm text-red-600">
                {suggestMutation.error instanceof ApiError
                  ? suggestMutation.error.message
                  : 'Không soạn được gợi ý'}
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-slate-900">Người nhận</p>
            <p className="text-[12px] text-slate-500">Đã chọn {selected.size}</p>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <StatusChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              Tất cả ({applicants.length})
            </StatusChip>
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
            <p className="mt-3 text-sm text-slate-500">Tin này chưa có ứng viên ứng tuyển.</p>
          ) : (
            <>
              <label className="mt-2 flex items-center gap-2 text-[13px] font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={allVisibleChecked}
                  disabled={mutation.isPending || visibleIds.length === 0}
                  onChange={(e) => toggleIds(visibleIds, e.target.checked)}
                />
                Chọn tất cả đang hiện
              </label>
              <div className="mt-2 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {visibleGroups.map((group) => {
                  const ids = group.rows.map((row) => row.applicationId);
                  const groupChecked = ids.every((id) => selected.has(id));
                  return (
                    <div key={group.status}>
                      <label className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={groupChecked}
                          disabled={mutation.isPending}
                          onChange={(e) => toggleIds(ids, e.target.checked)}
                        />
                        {APPLICATION_STATUS_LABEL[group.status]}
                      </label>
                      <ul className="mt-1 space-y-1">
                        {group.rows.map((row) => (
                          <li key={row.applicationId}>
                            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                checked={selected.has(row.applicationId)}
                                disabled={mutation.isPending}
                                onChange={() => toggleOne(row.applicationId)}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-slate-900">
                                  {row.displayName}
                                </span>
                                <span className="block truncate text-[12px] text-slate-500">
                                  {row.currentPosition ? formatJobTitle(row.currentPosition) : 'Chưa có chức danh'}
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p className="mt-3 text-sm text-red-600">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Không gửi được email hàng loạt'}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
            Huỷ
          </Button>
        )}
        <Button
          type="button"
          disabled={mutation.isPending || suggestMutation.isPending || !canSend}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Đang gửi...' : `Gửi ${selected.size} thư`}
        </Button>
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
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold',
        active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
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
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
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
