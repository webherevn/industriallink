import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  CmsContentStatus,
  CmsContentType,
  cmsCategoryPublicPath,
  cmsPagePublicPath,
  cmsPostPublicPath,
  cwvRating,
  jobListingPath,
  type CwvFieldSet,
  type CwvJob,
  type CwvReport,
  type CwvRow,
  type CwvStrategy,
  type CwvTestResult,
  type CwvValue,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AiSettingsService } from '../ai/ai-settings.service';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_TIMEOUT_MS = 120_000;
const SCAN_CONCURRENCY = 2;
const TARGET_LIMIT = 40;
const RUM_DAYS = 28;
/** Ít hơn số mẫu này thì chỉ hiển thị, chưa cảnh báo. */
const RUM_MIN_SAMPLES = 5;
const INP_LIMIT_MS = 200;
const LCP_LIMIT_MS = 2500;

type Target = { path: string; title: string; kind: CwvRow['kind']; editPath: string | null };

type PsiMetrics = Record<string, { percentile?: number } | undefined> | undefined;

type PsiResponse = {
  error?: { message?: string };
  loadingExperience?: { metrics?: PsiMetrics; origin_fallback?: boolean };
  originLoadingExperience?: { metrics?: PsiMetrics };
  lighthouseResult?: {
    runtimeError?: { code?: string; message?: string };
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, { numericValue?: number } | undefined>;
  };
};

type ScanRow = {
  path: string;
  created_at: Date;
  performance: number | null;
  crux_url: boolean;
  field_lcp_ms: number | null;
  field_inp_ms: number | null;
  field_cls: number | null;
  lab_lcp_ms: number | null;
  lab_tbt_ms: number | null;
  lab_cls: number | null;
  lab_fcp_ms: number | null;
  lab_ttfb_ms: number | null;
  error: string | null;
};

type RumRow = { path: string; name: string; p75: number; samples: number };

function field(metrics: PsiMetrics, key: string): number | null {
  const value = metrics?.[key]?.percentile;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function audit(res: PsiResponse, key: string): number | null {
  const value = res.lighthouseResult?.audits?.[key]?.numericValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

/** PSI trả CLS nhân 100. */
function clsOf(value: number | null): number | null {
  return value === null ? null : Math.round(value) / 100;
}

function value(metric: 'LCP' | 'INP' | 'CLS', raw: number | null, source: CwvValue['source'], samples?: number): CwvValue | null {
  if (raw === null) return null;
  const v = metric === 'CLS' ? Math.round(raw * 1000) / 1000 : Math.round(raw);
  return { value: v, rating: cwvRating(metric, v), source, ...(samples !== undefined ? { samples } : {}) };
}

/** RUM chỉ đủ tin để cảnh báo khi có từ RUM_MIN_SAMPLES mẫu. */
function trusted(v: CwvValue | null): v is CwvValue {
  return Boolean(v && (v.source !== 'rum' || (v.samples ?? 0) >= RUM_MIN_SAMPLES));
}

function idleJob(strategy: CwvStrategy = 'mobile'): CwvJob {
  return { running: false, strategy, total: 0, done: 0, failed: 0, current: null, startedAt: null, finishedAt: null };
}

@Injectable()
export class SeoVitalsService {
  private readonly logger = new Logger(SeoVitalsService.name);
  private job: CwvJob = idleJob();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
  ) {}

  async report(strategy: CwvStrategy): Promise<CwvReport> {
    const [psi, targets] = await Promise.all([this.settings.resolvePagespeed(), this.targets()]);
    const since = new Date(Date.now() - RUM_DAYS * 24 * 60 * 60 * 1000);
    const devices = strategy === 'mobile' ? ['mobile', 'tablet'] : ['desktop'];

    const [scans, rum, rumTotal, origin] = await Promise.all([
      this.prisma.$queryRaw<ScanRow[]>`
        SELECT DISTINCT ON (path) path, created_at, performance, crux_url, field_lcp_ms, field_inp_ms, field_cls,
          lab_lcp_ms, lab_tbt_ms, lab_cls, lab_fcp_ms, lab_ttfb_ms, error
        FROM shared.cwv_scan
        WHERE strategy = ${strategy}
        ORDER BY path, created_at DESC
      `,
      this.prisma.$queryRaw<RumRow[]>`
        SELECT path, name,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::float8 AS p75,
          COUNT(*)::int AS samples
        FROM shared.web_vital_sample
        WHERE created_at >= ${since}
          AND name IN ('LCP', 'INP', 'CLS')
          AND device IN (${Prisma.join(devices)})
        GROUP BY path, name
      `,
      this.prisma.webVitalSample.count({ where: { createdAt: { gte: since }, device: { in: devices } } }),
      this.prisma.cwvScan.findFirst({
        where: {
          strategy,
          OR: [{ originLcpMs: { not: null } }, { originInpMs: { not: null } }, { originCls: { not: null } }],
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const scanByPath = new Map(scans.map((row) => [row.path, row]));
    const rumByPath = new Map<string, Map<string, RumRow>>();
    for (const row of rum) {
      const bucket = rumByPath.get(row.path) ?? new Map<string, RumRow>();
      bucket.set(row.name, row);
      rumByPath.set(row.path, bucket);
    }

    const all = new Map(targets.map((target) => [target.path, target]));
    for (const path of [...scanByPath.keys(), ...rumByPath.keys()]) {
      if (all.size >= TARGET_LIMIT + 20) break;
      if (!all.has(path)) all.set(path, { path, title: path, kind: 'visited', editPath: null });
    }

    const base = psi.siteUrl;
    const rows = [...all.values()].map((target) => this.row(target, base, scanByPath.get(target.path), rumByPath.get(target.path)));
    const kindOrder: Record<CwvRow['kind'], number> = { home: 0, hub: 1, category: 2, post: 3, page: 4, visited: 5 };
    rows.sort((a, b) => {
      const weight = (row: CwvRow) => (row.inpSlow ? 0 : row.inpRisk ? 1 : row.lcpSlow ? 2 : 3);
      return weight(a) - weight(b) || kindOrder[a.kind] - kindOrder[b.kind];
    });

    const originSet: CwvFieldSet | null = origin
      ? {
          lcp: value('LCP', origin.originLcpMs, 'crux-origin'),
          inp: value('INP', origin.originInpMs, 'crux-origin'),
          cls: value('CLS', origin.originCls, 'crux-origin'),
        }
      : null;

    return {
      generatedAt: new Date().toISOString(),
      strategy,
      siteUrl: base,
      hasKey: Boolean(psi.apiKey),
      origin: originSet,
      originCheckedAt: origin ? origin.createdAt.toISOString() : null,
      rumSamples: rumTotal,
      rumDays: RUM_DAYS,
      summary: {
        urls: rows.length,
        scanned: rows.filter((row) => row.scan && !row.scan.error).length,
        inpSlow: rows.filter((row) => row.inpSlow).length,
        inpRisk: rows.filter((row) => row.inpRisk).length,
        lcpSlow: rows.filter((row) => row.lcpSlow).length,
        clsPoor: rows.filter((row) => trusted(row.cls) && row.cls.rating !== 'good').length,
      },
      rows,
      job: { ...this.job },
    };
  }

  private row(target: Target, base: string | null, scan: ScanRow | undefined, rum: Map<string, RumRow> | undefined): CwvRow {
    const rumValue = (metric: 'LCP' | 'INP' | 'CLS') => {
      const hit = rum?.get(metric);
      return hit ? value(metric, hit.p75, 'rum', hit.samples) : null;
    };
    const rumSet = { lcp: rumValue('LCP'), inp: rumValue('INP'), cls: rumValue('CLS') };
    const samples = Math.max(0, ...[...(rum?.values() ?? [])].map((row) => row.samples));
    const crux = scan?.crux_url && !scan.error;

    const enough = (v: CwvValue | null) => (trusted(v) ? v : null);
    const inp = (crux ? value('INP', scan.field_inp_ms, 'crux-url') : null) ?? rumSet.inp;
    const lcp =
      (crux ? value('LCP', scan.field_lcp_ms, 'crux-url') : null) ??
      enough(rumSet.lcp) ??
      (scan && !scan.error ? value('LCP', scan.lab_lcp_ms, 'lab') : null) ??
      rumSet.lcp;
    const cls =
      (crux ? value('CLS', scan.field_cls, 'crux-url') : null) ??
      enough(rumSet.cls) ??
      (scan && !scan.error ? value('CLS', scan.lab_cls, 'lab') : null) ??
      rumSet.cls;

    const trustedInp = trusted(inp);
    const inpSlow = Boolean(trustedInp && inp.value > INP_LIMIT_MS);
    const inpRisk = !inpSlow && !trustedInp && (scan?.lab_tbt_ms ?? 0) > INP_LIMIT_MS;

    return {
      path: target.path,
      url: base ? `${base}${target.path}` : target.path,
      title: target.title,
      kind: target.kind,
      editPath: target.editPath,
      inp,
      lcp,
      cls,
      rum: { ...rumSet, samples },
      scan: scan
        ? {
            scannedAt: scan.created_at.toISOString(),
            performance: scan.performance,
            labLcpMs: scan.lab_lcp_ms,
            labTbtMs: scan.lab_tbt_ms,
            labCls: scan.lab_cls,
            labFcpMs: scan.lab_fcp_ms,
            labTtfbMs: scan.lab_ttfb_ms,
            cruxUrl: scan.crux_url,
            error: scan.error,
          }
        : null,
      inpSlow,
      inpRisk,
      lcpSlow: trusted(lcp) && lcp.value > LCP_LIMIT_MS,
    };
  }

  private async targets(): Promise<Target[]> {
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [categories, posts, pages] = await Promise.all([
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 10,
      }),
      this.prisma.cmsPost.findMany({
        where: { ...live, type: CmsContentType.Post },
        select: { id: true, title: true, slug: true },
        orderBy: { publishedAt: 'desc' },
        take: 15,
      }),
      this.prisma.cmsPost.findMany({
        where: { ...live, type: CmsContentType.Page },
        select: { id: true, title: true, slug: true },
        orderBy: { publishedAt: 'desc' },
        take: 8,
      }),
    ]);
    const out: Target[] = [
      { path: '/', title: 'Trang chủ', kind: 'home', editPath: '/admin/homepage' },
      { path: '/cam-nang', title: 'Cẩm nang', kind: 'hub', editPath: null },
      { path: jobListingPath(), title: 'Việc làm', kind: 'hub', editPath: null },
      ...categories.map((row) => ({
        path: cmsCategoryPublicPath(row.slug),
        title: row.name,
        kind: 'category' as const,
        editPath: '/admin/categories',
      })),
      ...posts.map((row) => ({
        path: cmsPostPublicPath(row.slug),
        title: row.title,
        kind: 'post' as const,
        editPath: `/admin/posts/${row.id}`,
      })),
      ...pages.map((row) => ({
        path: cmsPagePublicPath(row.slug),
        title: row.title,
        kind: 'page' as const,
        editPath: `/admin/pages/${row.id}`,
      })),
    ];
    const seen = new Set<string>();
    return out.filter((row) => (seen.has(row.path) ? false : (seen.add(row.path), true))).slice(0, TARGET_LIMIT);
  }

  status(): CwvJob {
    return { ...this.job };
  }

  async start(strategy: CwvStrategy, paths?: string[]): Promise<CwvJob> {
    if (this.job.running) throw new ConflictException('Đang có lượt quét PageSpeed chạy. Đợi xong rồi quét tiếp.');
    const psi = await this.settings.resolvePagespeed();
    if (!psi.apiKey) throw new ConflictException('Chưa lưu khóa PageSpeed Insights.');
    if (!psi.siteUrl) throw new ConflictException('Chưa đặt domain công khai (ví dụ https://inlink.vn). PageSpeed không tải được localhost.');
    const list = paths?.length ? [...new Set(paths)] : (await this.targets()).map((row) => row.path);
    this.job = {
      running: true,
      strategy,
      total: list.length,
      done: 0,
      failed: 0,
      current: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    void this.run(list, strategy, psi.apiKey, psi.siteUrl);
    return { ...this.job };
  }

  private async run(paths: string[], strategy: CwvStrategy, apiKey: string, siteUrl: string): Promise<void> {
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const path = paths[next++]!;
        this.job.current = path;
        const ok = await this.scanOne(path, strategy, apiKey, siteUrl);
        this.job.done += 1;
        if (!ok) this.job.failed += 1;
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, paths.length) }, worker));
    } catch (err) {
      this.logger.error(`Quét PageSpeed dừng: ${String(err)}`);
    } finally {
      this.job.running = false;
      this.job.current = null;
      this.job.finishedAt = new Date().toISOString();
    }
  }

  private async scanOne(path: string, strategy: CwvStrategy, apiKey: string, siteUrl: string): Promise<boolean> {
    const url = `${siteUrl}${path}`;
    const res = await this.callPsi(url, strategy, apiKey);
    const le = res.data?.loadingExperience;
    const cruxUrl = Boolean(le?.metrics && !le.origin_fallback && Object.keys(le.metrics).length > 0);
    const origin = res.data?.originLoadingExperience?.metrics;
    const score = res.data?.lighthouseResult?.categories?.performance?.score;
    await this.prisma.cwvScan.create({
      data: {
        path,
        url,
        strategy,
        performance: typeof score === 'number' ? Math.round(score * 100) : null,
        cruxUrl,
        fieldLcpMs: cruxUrl ? round(field(le?.metrics, 'LARGEST_CONTENTFUL_PAINT_MS')) : null,
        fieldInpMs: cruxUrl ? round(field(le?.metrics, 'INTERACTION_TO_NEXT_PAINT')) : null,
        fieldCls: cruxUrl ? clsOf(field(le?.metrics, 'CUMULATIVE_LAYOUT_SHIFT_SCORE')) : null,
        originLcpMs: round(field(origin, 'LARGEST_CONTENTFUL_PAINT_MS')),
        originInpMs: round(field(origin, 'INTERACTION_TO_NEXT_PAINT')),
        originCls: clsOf(field(origin, 'CUMULATIVE_LAYOUT_SHIFT_SCORE')),
        labLcpMs: res.data ? round(audit(res.data, 'largest-contentful-paint')) : null,
        labTbtMs: res.data ? round(audit(res.data, 'total-blocking-time')) : null,
        labCls: res.data ? audit(res.data, 'cumulative-layout-shift') : null,
        labFcpMs: res.data ? round(audit(res.data, 'first-contentful-paint')) : null,
        labTtfbMs: res.data ? round(audit(res.data, 'server-response-time')) : null,
        error: res.error?.slice(0, 400) ?? null,
      },
    });
    return !res.error;
  }

  private async callPsi(url: string, strategy: CwvStrategy, apiKey: string): Promise<{ data: PsiResponse | null; error: string | null }> {
    const query = new URLSearchParams({ url, strategy, category: 'performance', key: apiKey });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
    try {
      const response = await fetch(`${PSI_ENDPOINT}?${query.toString()}`, { signal: controller.signal });
      const data = (await response.json().catch(() => null)) as PsiResponse | null;
      if (!response.ok || !data) {
        return { data: null, error: `PageSpeed HTTP ${response.status}: ${data?.error?.message ?? 'không đọc được phản hồi'}` };
      }
      const runtime = data.lighthouseResult?.runtimeError;
      if (runtime?.code && runtime.code !== 'NO_ERROR') {
        return { data, error: `Lighthouse ${runtime.code}: ${runtime.message ?? ''}`.trim() };
      }
      return { data, error: null };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return { data: null, error: aborted ? 'PageSpeed quá 120 giây không trả kết quả.' : `Không gọi được PageSpeed: ${String(err)}` };
    } finally {
      clearTimeout(timer);
    }
  }

  async test(): Promise<CwvTestResult> {
    const psi = await this.settings.resolvePagespeed();
    const url = psi.siteUrl ? `${psi.siteUrl}/` : '';
    if (!psi.apiKey) return { ok: false, url, latencyMs: 0, message: 'Chưa lưu khóa PageSpeed Insights.', performance: null };
    if (!psi.siteUrl) {
      return { ok: false, url, latencyMs: 0, message: 'Chưa đặt domain công khai. PageSpeed không tải được localhost.', performance: null };
    }
    const started = Date.now();
    const res = await this.callPsi(url, 'mobile', psi.apiKey);
    const score = res.data?.lighthouseResult?.categories?.performance?.score;
    return {
      ok: !res.error,
      url,
      latencyMs: Date.now() - started,
      message: res.error ?? 'Khóa PageSpeed Insights gọi được (thử trên trang chủ, mobile). Bấm «Quét PageSpeed» để lưu số đo.',
      performance: typeof score === 'number' ? Math.round(score * 100) : null,
    };
  }

  @Cron('0 30 2 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async dailyScan(): Promise<void> {
    await this.prisma.cwvScan.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } });
    const psi = await this.settings.resolvePagespeed().catch(() => null);
    if (!psi?.apiKey || !psi.siteUrl || !psi.autoScan || this.job.running) return;
    try {
      await this.start('mobile');
      this.logger.log('Bắt đầu quét PageSpeed hằng ngày (mobile).');
    } catch (err) {
      this.logger.warn(`Không chạy được quét PageSpeed hằng ngày: ${String(err)}`);
    }
  }
}
