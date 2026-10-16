'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getApiBase } from '@/lib/api';

const CODE = /^CTV[0-9A-F]{4}$/i;

/** Bấm link cộng tác viên thì nhờ API ghi cookie 14 ngày. Mã không nằm trong localStorage. */
export function ReferralCookie() {
  const ref = useSearchParams().get('ref');
  const sent = useRef<string | null>(null);

  useEffect(() => {
    const code = ref?.trim().toUpperCase() ?? '';
    if (!CODE.test(code) || sent.current === code) return;
    sent.current = code;
    void fetch(`${getApiBase()}/crm/referrals/click`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => undefined);
  }, [ref]);

  return null;
}
