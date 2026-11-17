import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateB2BJobSlug, isDemoJobCode, nextUniqueSlug } from '@industriallink/contracts';

const LEGACY_MAP_PATH = join(__dirname, '..', 'src', 'shared', 'seo', 'legacy-job-slugs.json');

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    const existingMap: Record<string, string> = existsSync(LEGACY_MAP_PATH)
      ? (JSON.parse(readFileSync(LEGACY_MAP_PATH, 'utf8')) as Record<string, string>)
      : {};

    const jobs = await prisma.job.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        code: true,
        title: true,
        slug: true,
        industry: true,
        location: true,
        company: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const taken = new Set<string>(
      jobs.map((j) => j.slug).filter((s): s is string => Boolean(s)),
    );
    let updatedCount = 0;

    for (const job of jobs) {
      if (isDemoJobCode(job.code)) continue;
      const base = generateB2BJobSlug(
        {
          title: job.title,
          code: job.code,
          id: job.id,
          industry: job.industry,
          location: job.location,
        },
        { name: job.company?.name },
      );

      if (job.slug === base) continue;
      if (job.slug) taken.delete(job.slug);
      const nextSlug = nextUniqueSlug(base, taken);
      taken.add(nextSlug);

      if (job.slug && job.slug !== nextSlug) {
        existingMap[job.slug.toLowerCase()] = job.code;
      }

      console.log(
        `${dryRun ? '[DRY-RUN] ' : ''}${job.code}: ${job.slug ?? '(null)'} -> ${nextSlug}`,
      );
      if (!dryRun) {
        await prisma.job.update({
          where: { id: job.id },
          data: { slug: nextSlug },
        });
      }
      updatedCount += 1;
    }

    if (!dryRun) {
      writeFileSync(LEGACY_MAP_PATH, `${JSON.stringify(existingMap, null, 2)}\n`, 'utf8');
    }
    console.log(
      `${dryRun ? '[DRY-RUN] ' : ''}Hoàn tất: ${updatedCount} tin tuyển dụng được chuẩn hóa slug B2B.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
