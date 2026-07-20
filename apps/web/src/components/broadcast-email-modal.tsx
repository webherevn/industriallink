'use client';

import { useMutation } from '@tanstack/react-query';
import { ApplicationStatus } from '@industriallink/contracts';
import { useState } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { APPLICATION_STATUS_LABEL } from '@/lib/format';
import { broadcastJobEmail } from '@/lib/jobs';

export function BroadcastEmailModal({
  jobId,
  onClose,
  onSent,
}: {
  jobId: string;
  onClose: () => void;
  onSent?: (result: { recipients: number; sent: number; failed: number }) => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('all');

  const mutation = useMutation({
    mutationFn: () =>
      broadcastJobEmail(jobId, {
        subject: subject.trim(),
        body: body.trim(),
        status: status === 'all' ? undefined : (status as ApplicationStatus),
      }),
    onSuccess: (result) => {
      onSent?.(result);
      onClose();
    },
  });

  const canSend = subject.trim().length >= 3 && body.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Gửi email hàng loạt</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gửi cùng một thông báo tới ứng viên của tin này (qua Email Gateway).
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Lọc theo trạng thái">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={mutation.isPending}
            >
              <option value="all">Tất cả ứng viên</option>
              {Object.values(ApplicationStatus).map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tiêu đề *">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Cập nhật lịch phỏng vấn vòng 2"
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Nội dung *">
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Xin chào,&#10;&#10;Chúng tôi muốn thông báo…"
              disabled={mutation.isPending}
            />
          </Field>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Không gửi được email hàng loạt'}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !canSend}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Đang gửi...' : 'Gửi hàng loạt'}
          </Button>
        </div>
      </div>
    </div>
  );
}
