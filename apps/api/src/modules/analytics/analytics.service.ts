import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { CollectHitDto } from './dto/collect-hit.dto';

const DIRECT = 'Trực tiếp';
const SELF_HOSTS = new Set(['inlink.vn', 'www.inlink.vn', 'localhost', '127.0.0.1']);
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|wget|curl\//i;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type AnalyticsRange = 'today' | '7d' | '30d';

type SeriesRow = { label: string; visitors: number; pageviews: number };
type PageRow = {
  path: string;
  pageviews: number;
  visitors: number;
  avg_duration_ms: number;
};
type PathCountRow = { path: string; sessions: number };
type SourceRow = { source: string; sessions: number };
type DeviceRow = { device: string; sessions: number };
type PeriodRow = {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounce: number | null;
  engagement: number | null;
  avg_session_ms: number | null;
  pages_per_session: number | null;
  new_visitors: number;
};
type SessionRow = {
  session_id: string;
  started_at: Date;
  last_seen_at: Date;
  pageviews: number;
  duration_ms: number;
  path: string;
  landing: string;
  device: string;
  source: string;
};
type HitRow = {
  path: string;
  title: string | null;
  created_at: Date;
  ip: string | null;
  user_agent: string | null;
  device: string;
  source: string;
  visitor_id: string;
  referrer: string | null;
  duration_ms: number;
};

function num(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function vnWall(now = new Date()): { y: number; m: number; d: number; h: number } {
  const shifted = new Date(now.getTime() + VN_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
  };
}

function vnMidnightUtc(dayOffset = 0, now = new Date()): Date {
  const wall = vnWall(now);
  const utcMidnight = Date.UTC(wall.y, wall.m, wall.d + dayOffset);
  return new Date(utcMidnight - VN_OFFSET_MS);
}

export function analyticsRange(preset: string | undefined, now = new Date()): {
  key: AnalyticsRange;
  from: Date;
  to: Date;
} {
  const key: AnalyticsRange = preset === 'today' || preset === '30d' ? preset : '7d';
  const todayStart = vnMidnightUtc(0, now);
  const tomorrow = vnMidnightUtc(1, now);
  if (key === 'today') return { key, from: todayStart, to: tomorrow };
  const days = key === '30d' ? 30 : 7;
  return { key, from: vnMidnightUtc(1 - days, now), to: tomorrow };
}

function normalizePath(raw: string): { path: string; search: string } | null {
  const text = raw.trim();
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('://') || text.includes('\\')) {
    return null;
  }
  const hashless = text.split('#')[0] ?? '';
  const [pathname, search = ''] = hashless.split('?');
  const path = (pathname ?? '').slice(0, 500);
  if (!path.startsWith('/') || path.includes('..')) return null;
  return { path, search: search.slice(0, 300) };
}

function isTrackedPath(path: string): boolean {
  return !path.startsWith('/admin') && !path.startsWith('/api') && !path.startsWith('/_next');
}

function deviceOf(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet';
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

function sourceOf(referrer: string | undefined, search: string): string {
  const utm = new URLSearchParams(search).get('utm_source')?.trim();
  if (utm) return utm.slice(0, 200);
  if (!referrer?.trim()) return DIRECT;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (!host || SELF_HOSTS.has(host) || host.endsWith('.inlink.vn')) return DIRECT;
    return host.slice(0, 200);
  } catch {
    return DIRECT;
  }
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  const ip = (raw || req.ip || '').replace(/^::ffff:/, '').trim();
  if (!ip) return null;
  return ip.slice(0, 64);
}

function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, '\\$&')}%`;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async collect(dto: CollectHitDto, req: Request): Promise<{ ok: true }> {
    const purpose = String(req.headers['sec-purpose'] || req.headers.purpose || '');
    if (/prefetch/i.test(purpose)) return { ok: true };

    const ua = String(req.headers['user-agent'] || '').slice(0, 400);
    if (!ua || BOT_UA.test(ua)) return { ok: true };

    const parsed = normalizePath(dto.path);
    if (!parsed || !isTrackedPath(parsed.path)) return { ok: true };

    const durationMs = Math.max(0, Math.min(30 * 60 * 1000, Math.round(dto.durationMs ?? 0)));
    if (durationMs > 0) {
      const sinceStay = new Date(Date.now() - 45 * 60 * 1000);
      await this.prisma.$executeRaw`
        UPDATE shared.analytics_hit
        SET duration_ms = ${durationMs}
        WHERE id = (
          SELECT id FROM shared.analytics_hit
          WHERE session_id = ${dto.sessionId}
            AND path = ${parsed.path}
            AND created_at >= ${sinceStay}
          ORDER BY created_at DESC
          LIMIT 1
        )
        AND duration_ms < ${durationMs}
      `;
      return { ok: true };
    }

    const since = new Date(Date.now() - 15_000);
    const duplicate = await this.prisma.analyticsHit.findFirst({
      where: { sessionId: dto.sessionId, path: parsed.path, createdAt: { gte: since } },
      select: { id: true },
    });
    if (duplicate) return { ok: true };

    await this.prisma.analyticsHit.create({
      data: {
        visitorId: dto.visitorId,
        sessionId: dto.sessionId,
        path: parsed.path,
        title: dto.title?.trim().slice(0, 300) || null,
        referrer: dto.referrer?.trim().slice(0, 500) || null,
        source: sourceOf(dto.referrer, parsed.search),
        ip: clientIp(req),
        userAgent: ua || null,
        device: deviceOf(ua),
      },
    });
    return { ok: true };
  }

  async overview(preset: string | undefined) {
    const range = analyticsRange(preset);
    const hourMode = range.key === 'today';
    const bucket = hourMode
      ? Prisma.sql`to_char(date_trunc('hour', (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'HH24:00')`
      : Prisma.sql`to_char(date_trunc('day', (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'DD/MM')`;

    const span = range.to.getTime() - range.from.getTime();
    const previous = { from: new Date(range.from.getTime() - span), to: range.from };

    const [current, prior, series, topPages, landings, exits, topReferrers, devices] = await Promise.all([
      this.periodStats(range.from, range.to),
      this.periodStats(previous.from, previous.to),
      this.prisma.$queryRaw<SeriesRow[]>`
        SELECT
          ${bucket} AS label,
          COUNT(DISTINCT visitor_id)::int AS visitors,
          COUNT(*)::int AS pageviews
        FROM shared.analytics_hit
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.$queryRaw<PageRow[]>`
        SELECT
          path,
          COUNT(*)::int AS pageviews,
          COUNT(DISTINCT visitor_id)::int AS visitors,
          COALESCE(ROUND(AVG(NULLIF(duration_ms, 0)))::int, 0) AS avg_duration_ms
        FROM shared.analytics_hit
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY path
        ORDER BY pageviews DESC
        LIMIT 8
      `,
      this.edgePages(range.from, range.to, 'ASC'),
      this.edgePages(range.from, range.to, 'DESC'),
      this.prisma.$queryRaw<SourceRow[]>`
        SELECT source, COUNT(DISTINCT session_id)::int AS sessions
        FROM shared.analytics_hit
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY source
        ORDER BY sessions DESC
        LIMIT 8
      `,
      this.prisma.$queryRaw<DeviceRow[]>`
        SELECT device, COUNT(DISTINCT session_id)::int AS sessions
        FROM shared.analytics_hit
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY device
        ORDER BY sessions DESC
      `,
    ]);

    return {
      range: range.key,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      ...current,
      previous: prior,
      series: this.fillSeries(range, series, hourMode),
      topPages: topPages.map((row) => ({
        path: row.path,
        pageviews: num(row.pageviews),
        visitors: num(row.visitors),
        avgDurationMs: num(row.avg_duration_ms),
      })),
      landings: landings.map((row) => ({ path: row.path, sessions: num(row.sessions) })),
      exits: exits.map((row) => ({ path: row.path, sessions: num(row.sessions) })),
      topReferrers: topReferrers.map((row) => ({
        source: row.source,
        sessions: num(row.sessions),
      })),
      devices: devices.map((row) => ({
        device: row.device,
        sessions: num(row.sessions),
      })),
    };
  }

  private async periodStats(from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<PeriodRow[]>`
      WITH range_hits AS (
        SELECT * FROM shared.analytics_hit
        WHERE created_at >= ${from} AND created_at < ${to}
      ),
      sessions AS (
        SELECT
          session_id,
          COUNT(*)::int AS pageviews,
          GREATEST(
            COALESCE(SUM(duration_ms), 0),
            EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) * 1000
          ) AS engaged_ms
        FROM range_hits
        GROUP BY session_id
      )
      SELECT
        (SELECT COUNT(DISTINCT visitor_id)::int FROM range_hits) AS visitors,
        (SELECT COUNT(*)::int FROM sessions) AS sessions,
        (SELECT COUNT(*)::int FROM range_hits) AS pageviews,
        (SELECT (COUNT(*) FILTER (WHERE pageviews = 1))::float / NULLIF(COUNT(*), 0) FROM sessions) AS bounce,
        (SELECT (COUNT(*) FILTER (WHERE pageviews >= 2 OR engaged_ms >= 10000))::float / NULLIF(COUNT(*), 0) FROM sessions) AS engagement,
        (SELECT AVG(engaged_ms) FROM sessions) AS avg_session_ms,
        (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(pageviews)::float / COUNT(*) END FROM sessions) AS pages_per_session,
        (
          SELECT COUNT(*)::int FROM (
            SELECT visitor_id
            FROM shared.analytics_hit
            GROUP BY visitor_id
            HAVING MIN(created_at) >= ${from} AND MIN(created_at) < ${to}
          ) newcomers
        ) AS new_visitors
    `;
    const row = rows[0];
    const visitors = num(row?.visitors);
    const newVisitors = Math.min(visitors, num(row?.new_visitors));
    return {
      visitors,
      sessions: num(row?.sessions),
      pageviews: num(row?.pageviews),
      bounceRate: Math.round(num(row?.bounce) * 1000) / 10,
      engagementRate: Math.round(num(row?.engagement) * 1000) / 10,
      avgSessionMs: Math.round(num(row?.avg_session_ms)),
      pagesPerSession: Math.round(num(row?.pages_per_session) * 10) / 10,
      newVisitors,
      returningVisitors: Math.max(0, visitors - newVisitors),
    };
  }

  private edgePages(from: Date, to: Date, direction: 'ASC' | 'DESC') {
    const order = direction === 'ASC' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$queryRaw<PathCountRow[]>`
      SELECT path, COUNT(*)::int AS sessions
      FROM (
        SELECT DISTINCT ON (session_id) path
        FROM shared.analytics_hit
        WHERE created_at >= ${from} AND created_at < ${to}
        ORDER BY session_id, created_at ${order}
      ) edges
      GROUP BY path
      ORDER BY sessions DESC
      LIMIT 6
    `;
  }

  async realtime() {
    const since = new Date(Date.now() - 5 * 60 * 1000);
    const [active, pages] = await Promise.all([
      this.prisma.$queryRaw<Array<{ visitors: number }>>`
        SELECT COUNT(DISTINCT visitor_id)::int AS visitors
        FROM shared.analytics_hit
        WHERE created_at >= ${since}
      `,
      this.prisma.$queryRaw<Array<{ path: string; visitors: number }>>`
        SELECT path, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM shared.analytics_hit
        WHERE created_at >= ${since}
        GROUP BY path
        ORDER BY visitors DESC
        LIMIT 8
      `,
    ]);
    return {
      activeVisitors: num(active[0]?.visitors),
      activeWindowSec: 300,
      pages: pages.map((row) => ({ path: row.path, visitors: num(row.visitors) })),
      updatedAt: new Date().toISOString(),
    };
  }

  async sessions(pageRaw?: string, qRaw?: string) {
    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = 20;
    const q = (qRaw ?? '').trim().slice(0, 200);
    const offset = (page - 1) * limit;
    const filter = q
      ? Prisma.sql`WHERE path ILIKE ${likePattern(q)} ESCAPE '\\' OR ip = ${q}`
      : Prisma.empty;

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<SessionRow[]>`
        SELECT
          session_id,
          MIN(created_at) AS started_at,
          MAX(created_at) AS last_seen_at,
          COUNT(*)::int AS pageviews,
          COALESCE(SUM(duration_ms), 0)::int AS duration_ms,
          (ARRAY_AGG(path ORDER BY created_at DESC))[1] AS path,
          (ARRAY_AGG(path ORDER BY created_at ASC))[1] AS landing,
          (ARRAY_AGG(device ORDER BY created_at DESC))[1] AS device,
          (ARRAY_AGG(source ORDER BY created_at ASC))[1] AS source
        FROM shared.analytics_hit
        ${filter}
        GROUP BY session_id
        ORDER BY MAX(created_at) DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(*)::int AS total FROM (
          SELECT session_id
          FROM shared.analytics_hit
          ${filter}
          GROUP BY session_id
        ) s
      `,
    ]);

    return {
      page,
      limit,
      total: num(totalRows[0]?.total),
      items: rows.map((row) => ({
        sessionId: row.session_id,
        startedAt: new Date(row.started_at).toISOString(),
        lastSeenAt: new Date(row.last_seen_at).toISOString(),
        pageviews: num(row.pageviews),
        durationMs: num(row.duration_ms),
        path: row.path,
        landing: row.landing,
        device: row.device,
        source: row.source,
      })),
    };
  }

  async sessionDetail(sessionId: string) {
    if (!ID_RE.test(sessionId)) throw new NotFoundException('Không thấy phiên');
    const hits = await this.prisma.$queryRaw<HitRow[]>`
      SELECT path, title, created_at, ip, user_agent, device, source, visitor_id, referrer, duration_ms
      FROM shared.analytics_hit
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;
    if (hits.length === 0) throw new NotFoundException('Không thấy phiên');
    const last = hits[hits.length - 1];
    const ips = [...new Set(hits.map((hit) => hit.ip).filter((ip): ip is string => Boolean(ip)))];
    return {
      sessionId,
      visitorId: hits[0].visitor_id,
      ip: last.ip,
      ips,
      userAgent: last.user_agent,
      device: last.device,
      source: hits[0].source,
      referrer: hits[0].referrer,
      startedAt: new Date(hits[0].created_at).toISOString(),
      lastSeenAt: new Date(last.created_at).toISOString(),
      hits: hits.map((hit) => ({
        path: hit.path,
        title: hit.title,
        createdAt: new Date(hit.created_at).toISOString(),
        durationMs: num(hit.duration_ms),
      })),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldHits(): Promise<void> {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const removed = await this.prisma.analyticsHit.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (removed.count > 0) {
      this.logger.log(`Đã xoá ${removed.count} lượt xem cũ hơn 180 ngày`);
    }
  }

  private fillSeries(
    range: { from: Date; to: Date; key: AnalyticsRange },
    rows: SeriesRow[],
    hourMode: boolean,
  ) {
    const map = new Map<string, { visitors: number; pageviews: number }>();
    for (const row of rows) {
      map.set(row.label, { visitors: num(row.visitors), pageviews: num(row.pageviews) });
    }
    const points: Array<{ label: string; visitors: number; pageviews: number }> = [];
    if (hourMode) {
      const hours = vnWall().h;
      for (let hour = 0; hour <= hours; hour += 1) {
        const label = `${String(hour).padStart(2, '0')}:00`;
        const found = map.get(label);
        points.push({ label, visitors: found?.visitors ?? 0, pageviews: found?.pageviews ?? 0 });
      }
      return points;
    }
    const cursor = new Date(range.from);
    while (cursor < range.to) {
      const wall = vnWall(cursor);
      const label = `${String(wall.d).padStart(2, '0')}/${String(wall.m + 1).padStart(2, '0')}`;
      const found = map.get(label);
      points.push({ label, visitors: found?.visitors ?? 0, pageviews: found?.pageviews ?? 0 });
      cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    return points;
  }
}
