import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateB2BJobSlug,
  nextUniqueSlug,
  toSeoSlug,
  type B2BJobSlugInput,
} from '@industriallink/contracts';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';

export interface AllocateJobSlugOptions {
  code?: string | null;
  id?: string | null;
  industry?: string | null;
  location?: string | null;
  companyName?: string | null;
}

let cachedLegacySlugMap: Map<string, string> | null = null;

function getLegacySlugMap(): Map<string, string> {
  if (cachedLegacySlugMap) return cachedLegacySlugMap;
  const candidates = [
    join(__dirname, 'legacy-job-slugs.json'),
    join(process.cwd(), 'src/shared/seo/legacy-job-slugs.json'),
    join(process.cwd(), 'apps/api/src/shared/seo/legacy-job-slugs.json'),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, string>;
        cachedLegacySlugMap = new Map(Object.entries(raw));
        return cachedLegacySlugMap;
      } catch {
        // Ignore malformed file and fall back to empty map
      }
    }
  }
  cachedLegacySlugMap = new Map();
  return cachedLegacySlugMap;
}

export function resolveLegacyJobRef(slug: string): string | null {
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  return getLegacySlugMap().get(key) ?? null;
}

export async function allocateUniqueJobSlug(
  prisma: PrismaService,
  titleOrJob: string | B2BJobSlugInput,
  excludeId?: string,
  options?: AllocateJobSlugOptions,
): Promise<string> {
  const input: B2BJobSlugInput =
    typeof titleOrJob === 'string'
      ? {
          title: titleOrJob,
          code: options?.code,
          id: options?.id ?? excludeId,
          industry: options?.industry,
          location: options?.location,
        }
      : titleOrJob;

  const base =
    input.code || input.industry || options?.companyName
      ? generateB2BJobSlug(input, { name: options?.companyName })
      : toSeoSlug(input.title);

  const rows = await prisma.job.findMany({
    where: {
      slug: { startsWith: base },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  return nextUniqueSlug(
    base,
    rows.map((r) => r.slug),
  );
}

export async function allocateUniqueCompanySlug(
  prisma: PrismaService,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = toSeoSlug(name);
  const rows = await prisma.company.findMany({
    where: {
      slug: { startsWith: base },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });
  return nextUniqueSlug(
    base,
    rows.map((r) => r.slug),
  );
}

/** Gán slug cho tin cũ chưa có (in-place trên mảng). */
export async function backfillMissingJobSlugs(
  prisma: PrismaService,
  jobs: { id: string; title: string; slug: string | null }[],
): Promise<void> {
  const missing = jobs.filter((j) => !j.slug);
  if (missing.length === 0) return;
  const existing = await prisma.job.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  const taken = existing.map((r) => r.slug);
  for (const job of missing) {
    const slug = nextUniqueSlug(toSeoSlug(job.title), taken);
    taken.push(slug);
    await prisma.job.update({ where: { id: job.id }, data: { slug } });
    job.slug = slug;
  }
}

/** Gán slug cho công ty cũ chưa có (in-place trên mảng). */
export async function backfillMissingCompanySlugs(
  prisma: PrismaService,
  companies: { id: string; name: string; slug: string | null }[],
): Promise<void> {
  const missing = companies.filter((c) => !c.slug);
  if (missing.length === 0) return;
  const existing = await prisma.company.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  const taken = existing.map((r) => r.slug);
  for (const company of missing) {
    const slug = nextUniqueSlug(toSeoSlug(company.name), taken);
    taken.push(slug);
    await prisma.company.update({ where: { id: company.id }, data: { slug } });
    company.slug = slug;
  }
}
