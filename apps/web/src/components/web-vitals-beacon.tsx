'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { getApiBase } from '@/lib/api';

const TRACKED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

/** Chỉ số của một lượt tải thuộc về trang khách mở đầu tiên, kể cả khi sau đó chuyển trang trong app. */
let landingPath: string | null = null;

type ReportedMetric = { name: string; value: number; id: string; navigationType?: string };

function report(metric: ReportedMetric) {
  const path = landingPath ?? window.location.pathname;
  if (!TRACKED.has(metric.name) || path.startsWith('/admin') || !Number.isFinite(metric.value)) return;
  void fetch(`${getApiBase()}/analytics/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: path.slice(0, 600),
      name: metric.name,
      value: metric.value,
      id: metric.id,
      navigationType: metric.navigationType,
    }),
    keepalive: true,
    credentials: 'omit',
  }).catch(() => undefined);
}

/** Gửi LCP, INP, CLS, FCP, TTFB đo trên trình duyệt khách. Không chạy trên /admin. */
export function WebVitalsBeacon() {
  if (landingPath === null && typeof window !== 'undefined') landingPath = window.location.pathname;
  useReportWebVitals(report);
  return null;
}
