/** Core Web Vitals: PageSpeed Insights (CrUX + Lighthouse) và đo thật trên trình duyệt khách. */

export type CwvMetricName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
export type CwvRating = 'good' | 'needs-improvement' | 'poor';
export type CwvStrategy = 'mobile' | 'desktop';
/** Nguồn số liệu: CrUX theo URL, CrUX cả domain, đo thật trên inlink (RUM), hoặc Lighthouse (lab). */
export type CwvSource = 'crux-url' | 'crux-origin' | 'rum' | 'lab';

/** Ngưỡng Google: tốt ≤ good, kém > poor. */
export const CWV_THRESHOLDS: Record<'LCP' | 'INP' | 'CLS' | 'TBT' | 'FCP' | 'TTFB', { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TBT: { good: 200, poor: 600 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

export function cwvRating(metric: keyof typeof CWV_THRESHOLDS, value: number): CwvRating {
  const t = CWV_THRESHOLDS[metric];
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

export interface CollectWebVitalRequest {
  path: string;
  name: CwvMetricName;
  value: number;
  /** id của web-vitals, duy nhất cho mỗi lượt tải trang + chỉ số. */
  id: string;
  navigationType?: string;
}

export interface CwvValue {
  value: number;
  rating: CwvRating;
  source: CwvSource;
  /** Số mẫu khi source = rum. */
  samples?: number;
}

export interface CwvFieldSet {
  lcp: CwvValue | null;
  inp: CwvValue | null;
  cls: CwvValue | null;
}

export interface CwvRow {
  path: string;
  url: string;
  title: string;
  kind: 'home' | 'hub' | 'post' | 'page' | 'category' | 'visited';
  editPath: string | null;
  /** Giá trị dùng để cảnh báo: CrUX URL → đo thật inlink (≥ 5 mẫu) → CrUX domain. */
  inp: CwvValue | null;
  lcp: CwvValue | null;
  cls: CwvValue | null;
  /** Đo thật trên inlink trong 28 ngày, p75. */
  rum: CwvFieldSet & { samples: number };
  /** Lần quét PageSpeed gần nhất theo chiến lược đang xem. */
  scan: {
    scannedAt: string;
    performance: number | null;
    labLcpMs: number | null;
    labTbtMs: number | null;
    labCls: number | null;
    labFcpMs: number | null;
    labTtfbMs: number | null;
    cruxUrl: boolean;
    error: string | null;
  } | null;
  /** INP > 200ms theo dữ liệu thật. */
  inpSlow: boolean;
  /** Lab TBT > 200ms: nguy cơ INP chậm khi chưa có dữ liệu thật. */
  inpRisk: boolean;
  lcpSlow: boolean;
}

export interface CwvJob {
  running: boolean;
  strategy: CwvStrategy;
  total: number;
  done: number;
  failed: number;
  current: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CwvReport {
  generatedAt: string;
  strategy: CwvStrategy;
  siteUrl: string | null;
  hasKey: boolean;
  /** CrUX cả domain từ lần quét gần nhất (null nếu Google chưa đủ dữ liệu). */
  origin: CwvFieldSet | null;
  originCheckedAt: string | null;
  rumSamples: number;
  rumDays: number;
  summary: {
    urls: number;
    scanned: number;
    inpSlow: number;
    inpRisk: number;
    lcpSlow: number;
    clsPoor: number;
  };
  rows: CwvRow[];
  job: CwvJob;
}

export interface CwvSettingsView {
  hasKey: boolean;
  keyPreview: string | null;
  /** Domain công khai để PageSpeed tải, ví dụ https://inlink.vn. */
  siteUrl: string | null;
  defaultSiteUrl: string | null;
  autoScan: boolean;
  updatedAt: string | null;
}

export interface UpdateCwvSettingsRequest {
  /** Chuỗi rỗng / undefined = giữ; null = xoá. */
  apiKey?: string | null;
  siteUrl?: string | null;
  autoScan?: boolean;
}

export interface CwvTestResult {
  ok: boolean;
  url: string;
  latencyMs: number;
  message: string;
  performance: number | null;
}

export interface StartCwvScanRequest {
  strategy?: CwvStrategy;
  /** Bỏ trống = quét toàn bộ danh sách. */
  paths?: string[];
}
