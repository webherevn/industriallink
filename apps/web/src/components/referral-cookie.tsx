'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getApiBase } from '@/lib/api';

const CODE = /^CTV[0-9A-F]{4}$/i;

/** Bấm link cộng tác viên hoặc link quảng cáo UTM → lưu cookie 14 ngày xuyên subdomain. */
export function ReferralCookie() {
  const params = useSearchParams();
  const ref = params.get('ref');
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
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

  useEffect(() => {
    const source = (utmSource ?? '').trim().slice(0, 64);
    const medium = (utmMedium ?? '').trim().slice(0, 64);
    const campaign = (utmCampaign ?? '').trim().slice(0, 64);
    if (!source && !campaign) return;
    try {
      const payload = encodeURIComponent(
        JSON.stringify({ source, medium, campaign, at: new Date().toISOString() }),
      );
      const host = window.location.hostname;
      const domainAttr = host.endsWith('.inlink.vn') || host === 'inlink.vn' ? '; domain=.inlink.vn' : '';
      document.cookie = `il_utm=${payload}; path=/; max-age=${14 * 86400}; SameSite=Lax${domainAttr}`;
    } catch {
      /* ignore */
    }
  }, [utmSource, utmMedium, utmCampaign]);

  return null;
}
