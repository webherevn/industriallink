import { apiRequest, tokenStore } from '@/lib/api';

export type RecruiterActivityEventType =
  | 'login'
  | 'view_pricing'
  | 'hit_paywall'
  | 'ai_search_no_unlock';

const lastSentAt = new Map<RecruiterActivityEventType, number>();
const CLIENT_DEBOUNCE_MS = 5 * 60 * 1000;

/**
 * Gửi sự kiện hành vi nhẹ của NTD về CRM (fire-and-forget, không bao giờ chặn UI).
 * Debounce 5 phút ở client + 30 phút ở server.
 */
export function trackRecruiterActivity(
  eventType: RecruiterActivityEventType,
  detail?: string,
): void {
  if (typeof window === 'undefined' || !tokenStore.get()) return;
  const now = Date.now();
  const prev = lastSentAt.get(eventType) ?? 0;
  if (now - prev < CLIENT_DEBOUNCE_MS) return;
  lastSentAt.set(eventType, now);
  void apiRequest('/crm/recruiter-events', {
    method: 'POST',
    body: { eventType, ...(detail ? { detail } : {}) },
  }).catch(() => undefined);
}
