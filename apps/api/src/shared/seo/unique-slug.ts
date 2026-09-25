import { nextUniqueSlug, toSeoSlug } from '@industriallink/contracts';
import type { PrismaService } from '../infrastructure/prisma/prisma.service';


export async function allocateUniqueJobSlug(
  prisma: PrismaService,
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = toSeoSlug(title);
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
