import { apiRequest } from './api';

export type AnalyticsRange = 'today' | '7d' | '30d';

export interface AnalyticsPeriod {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  engagementRate: number;
  avgSessionMs: number;
  pagesPerSession: number;
  newVisitors: number;
  returningVisitors: number;
}

export interface AnalyticsOverview extends AnalyticsPeriod {
  range: AnalyticsRange;
  from: string;
  to: string;
  previous: AnalyticsPeriod;
  series: Array<{ label: string; visitors: number; pageviews: number }>;
  topPages: Array<{ path: string; pageviews: number; visitors: number; avgDurationMs: number }>;
  landings: Array<{ path: string; sessions: number }>;
  exits: Array<{ path: string; sessions: number }>;
  topReferrers: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string; sessions: number }>;
}

export interface AnalyticsRealtime {
  activeVisitors: number;
  activeWindowSec: number;
  pages: Array<{ path: string; visitors: number }>;
  updatedAt: string;
}

export interface AnalyticsSessionItem {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  pageviews: number;
  durationMs: number;
  path: string;
  landing: string;
  device: string;
  source: string;
}

export interface AnalyticsSessionPage {
  page: number;
  limit: number;
  total: number;
  items: AnalyticsSessionItem[];
}

export interface AnalyticsSessionDetail {
  sessionId: string;
  visitorId: string;
  ip: string | null;
  ips: string[];
  userAgent: string | null;
  device: string;
  source: string;
  referrer: string | null;
  startedAt: string;
  lastSeenAt: string;
  hits: Array<{ path: string; title: string | null; createdAt: string; durationMs: number }>;
}

export function fetchAnalyticsOverview(range: AnalyticsRange): Promise<AnalyticsOverview> {
  return apiRequest<AnalyticsOverview>(`/admin/analytics/overview?range=${range}`);
}

export function fetchAnalyticsRealtime(): Promise<AnalyticsRealtime> {
  return apiRequest<AnalyticsRealtime>('/admin/analytics/realtime');
}

export function fetchAnalyticsSessions(page: number, q: string): Promise<AnalyticsSessionPage> {
  const qs = new URLSearchParams({ page: String(page) });
  if (q) qs.set('q', q);
  return apiRequest<AnalyticsSessionPage>(`/admin/analytics/sessions?${qs}`);
}

export function fetchAnalyticsSession(sessionId: string): Promise<AnalyticsSessionDetail> {
  return apiRequest<AnalyticsSessionDetail>(`/admin/analytics/sessions/${encodeURIComponent(sessionId)}`);
}
