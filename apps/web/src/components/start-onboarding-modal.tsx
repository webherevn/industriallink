'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { startOnboarding } from '@/lib/onboarding';

export function StartOnboardingModal({
  applicationId,
  candidateName,
  defaultStartDate,
  onClose,
  onStarted,
}: {
  applicationId: string;
  candidateName: string;
  defaultStartDate?: string;
  onClose: () => void;
  onStarted?: () => void;
}) {
  const [startDate, setStartDate] = useState(defaultStartDate ?? '');
  const [reportLocation, setReportLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [checklist, setChecklist] = useState(
    '• Nộp CCCD + sổ BHXH\n• Nhận thẻ ra vào / đồng phục\n• Đào tạo ATLĐ & nội quy',
  );
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      startOnboarding({
        applicationId,
        startDate,
        reportLocation: reportLocation.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        checklist: checklist.trim() || undefined,
        notes: notes.trim() || undefined,
        moveToHired: true,
      }),
    onSuccess: () => {
      onStarted?.();
      onClose();
    },
  });

  const canSend = Boolean(startDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Bắt đầu nhận việc</h2>
        <p className="mt-1 text-sm text-slate-500">
          Nhân sự: <span className="font-medium text-slate-800">{candidateName}</span>
          {' · '}Email hướng dẫn sẽ gửi tới tài khoản đăng ký.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Ngày nhận việc *">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Địa điểm báo cáo">
            <Input
              value={reportLocation}
              onChange={(e) => setReportLocation(e.target.value)}
              placeholder="Cổng A — KCN Bắc Ninh"
              disabled={mutation.isPending}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Người liên hệ HR">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nguyễn Thị Hoa"
                disabled={mutation.isPending}
              />
            </Field>
            <Field label="Điện thoại">
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="0901234567"
                disabled={mutation.isPending}
              />
            </Field>
          </div>
          <Field label="Checklist ngày đầu">
            <Textarea
              rows={4}
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
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
              : 'Không tạo được tiến trình nhận việc'}
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
            {mutation.isPending ? 'Đang tạo...' : 'Bắt đầu + gửi email'}
          </Button>
        </div>
      </div>
    </div>
  );
}
