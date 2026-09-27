'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { getApiBase } from '@/lib/api';

const VISITOR_KEY = 'il_vid';
const SESSION_KEY = 'il_sid';
const SESSION_AT_KEY = 'il_sid_at';
const SESSION_MS = 30 * 60 * 1000;
const MAX_STAY_MS = 30 * 60 * 1000;

type ActiveView = {
  path: string;
  startedAt: number;
  visitorId: string;
  sessionId: string;
  title?: string;
  referrer?: string;
};

function storedId(storage: Storage, key: string): string {
  const current = storage.getItem(key);
  if (current && /^[A-Za-z0-9_-]{8,64}$/.test(current)) return current;
  const next = crypto.randomUUID().replace(/-/g, '');
  storage.setItem(key, next);
  return next;
}

function sessionId(): string {
  const now = Date.now();
  const last = Number(sessionStorage.getItem(SESSION_AT_KEY) || '0');
  const current = sessionStorage.getItem(SESSION_KEY);
  const fresh = !current || !last || now - last > SESSION_MS;
  const id = fresh ? crypto.randomUUID().replace(/-/g, '') : current;
  if (fresh) sessionStorage.setItem(SESSION_KEY, id);
  sessionStorage.setItem(SESSION_AT_KEY, String(now));
  return id;
}

function postHit(body: Record<string, unknown>) {
  void fetch(`${getApiBase()}/analytics/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
    credentials: 'omit',
  }).catch(() => undefined);
}

/** Ghi lượt xem và thời gian ở lại trang. Không chạy trên /admin. */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const search = useSearchParams();
  const lastSent = useRef('');
  const active = useRef<ActiveView | null>(null);

  function flushStay() {
    const view = active.current;
    if (!view) return;
    const durationMs = Math.min(MAX_STAY_MS, Date.now() - view.startedAt);
    if (durationMs < 800) return;
    postHit({
      visitorId: view.visitorId,
      sessionId: view.sessionId,
      path: view.path,
      title: view.title,
      referrer: view.referrer,
      durationMs: Math.round(durationMs),
    });
  }

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushStay();
    };
    window.addEventListener('pagehide', flushStay);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushStay);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    const qs = search.toString();
    const path = (qs ? `${pathname}?${qs}` : pathname).slice(0, 600);
    flushStay();

    const timer = window.setTimeout(() => {
      if (lastSent.current === path) return;
      lastSent.current = path;
      let visitorId = '';
      let sid = '';
      try {
        visitorId = storedId(localStorage, VISITOR_KEY);
        sid = sessionId();
      } catch {
        return;
      }
      const view: ActiveView = {
        path,
        startedAt: Date.now(),
        visitorId,
        sessionId: sid,
        title: document.title?.slice(0, 300) || undefined,
        referrer: document.referrer?.slice(0, 500) || undefined,
      };
      active.current = view;
      postHit({
        visitorId: view.visitorId,
        sessionId: view.sessionId,
        path: view.path,
        title: view.title,
        referrer: view.referrer,
      });
    }, 150);

    return () => {
      window.clearTimeout(timer);
      flushStay();
    };
  }, [pathname, search]);

  return null;
}
