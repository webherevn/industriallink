'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { errorText } from '@/components/crm/format';
import { requestEnterpriseConsult } from '@/lib/crm';

export function EnterpriseConsultButton({
  className,
  label,
  noteClassName,
  errorClassName,
}: {
  className: string;
  label: string;
  noteClassName: string;
  errorClassName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: requestEnterpriseConsult,
    onSuccess: (row) => {
      setError(null);
      setMessage(
        row.alreadyOpen
          ? `Đã có yêu cầu ${row.dealCode}. Người phụ trách ${row.ownerName} sẽ liên hệ.`
          : `Đã ghi ${row.dealCode}. Người phụ trách ${row.ownerName} sẽ liên hệ. Gói chưa được bật.`,
      );
    },
    onError: (err) => setError(errorText(err, 'Không gửi được yêu cầu tư vấn')),
  });

  return (
    <div className="min-w-0">
      <button type="button" className={className} disabled={send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? 'Đang gửi…' : label}
      </button>
      {message ? <p className={noteClassName}>{message}</p> : null}
      {error ? <p className={errorClassName}>{error}</p> : null}
    </div>
  );
}
