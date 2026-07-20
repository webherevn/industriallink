'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { createOffer } from '@/lib/offers';

export function SendOfferModal({
  applicationId,
  candidateName,
  onClose,
  onSent,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [salary, setSalary] = useState('20000000');
  const [startDate, setStartDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [benefits, setBenefits] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createOffer({
        applicationId,
        salary: Number(salary),
        currency: 'VND',
        startDate: startDate || undefined,
        expiresAt: expiresAt || undefined,
        benefits: benefits.trim() || undefined,
        notes: notes.trim() || undefined,
        moveToOffer: true,
      }),
    onSuccess: () => {
      onSent?.();
      onClose();
    },
  });

  const canSend = Number(salary) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Gửi đề nghị tuyển dụng</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ứng viên: <span className="font-medium text-slate-800">{candidateName}</span>
          {' · '}Email đề nghị sẽ gửi tới tài khoản đăng ký.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Mức lương đề nghị (VND/tháng) *">
            <Input
              type="number"
              min={0}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              disabled={mutation.isPending}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ngày nhận việc">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
            <Field label="Hạn phản hồi">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={mutation.isPending}
              />
            </Field>
          </div>
          <Field label="Phúc lợi kèm đề nghị">
            <Textarea
              rows={3}
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="Tháng 13, BHXH, hỗ trợ nhà ở…"
              disabled={mutation.isPending}
            />
          </Field>
          <Field label="Ghi chú nội bộ / gửi ứng viên">
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
              : 'Không gửi được đề nghị'}
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
            {mutation.isPending ? 'Đang gửi...' : 'Gửi đề nghị + email'}
          </Button>
        </div>
      </div>
    </div>
  );
}
