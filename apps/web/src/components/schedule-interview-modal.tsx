'use client';

import { useMutation } from '@tanstack/react-query';
import { InterviewType } from '@industriallink/contracts';
import { useState } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { INTERVIEW_TYPE_LABEL } from '@/lib/format';
import { scheduleInterview } from '@/lib/interviews';

function defaultLocalDatetime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleInterviewModal({
  applicationId,
  candidateName,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
  onScheduled?: () => void;
}) {
  const [type, setType] = useState<InterviewType>(InterviewType.Hr);
  const [scheduledLocal, setScheduledLocal] = useState(defaultLocalDatetime);
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      scheduleInterview({
        applicationId,
        type,
        scheduledAt: new Date(scheduledLocal).toISOString(),
        durationMinutes: Number(durationMinutes) || 60,
        meetingLink: meetingLink.trim() || undefined,
        location: location.trim() || undefined,
        interviewerName: interviewerName.trim() || undefined,
        notes: notes.trim() || undefined,
        moveToInterview: true,
      }),
    onSuccess: () => {
      onScheduled?.();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Đặt lịch phỏng vấn</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ứng viên: <span className="font-medium text-slate-800">{candidateName}</span>
          {' · '}Email mời sẽ gửi tới tài khoản đăng ký của ứng viên.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Loại phỏng vấn">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as InterviewType)}
              disabled={mutation.isPending}
            >
              {Object.values(InterviewType).map((t) => (
                <option key={t} value={t}>
                  {INTERVIEW_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Thời gian *">
              <Input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field label="Thời lượng (phút)">
              <Input
                type="number"
                min={15}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>
          <Field label="Link họp (Meet / Zoom…)">
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Địa điểm">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Phòng họp A — KCN…"
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Người phỏng vấn">
            <Input
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="Họ tên — Nhân sự / Trưởng nhóm kỹ thuật"
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Ghi chú">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={mutation.isPending}
            />
          </Field>
        </div>

        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Không đặt được lịch'}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || !scheduledLocal}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Đang lưu...' : 'Đặt lịch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
