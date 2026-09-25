import { PrismaClient } from '@prisma/client';
import { nextUniqueSlug, toSeoSlug } from '@industriallink/contracts';

const prisma = new PrismaClient();

async function backfill(
  rows: { id: string; label: string; slug: string | null }[],
  update: (id: string, slug: string) => Promise<unknown>,
) {
  const taken = rows.map((r) => r.slug);
  let count = 0;
  for (const row of rows) {
    if (row.slug) continue;
    const slug = nextUniqueSlug(toSeoSlug(row.label), taken);
    taken.push(slug);
    await update(row.id, slug);
    count += 1;
  }
  return count;
}

async function main() {
  const jobs = await prisma.job.findMany({ select: { id: true, title: true, slug: true } });
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, slug: true },
  });
  const jobCount = await backfill(
    jobs.map((j) => ({ id: j.id, label: j.title, slug: j.slug })),
    (id, slug) => prisma.job.update({ where: { id }, data: { slug } }),
  );
  const companyCount = await backfill(
    companies.map((c) => ({ id: c.id, label: c.name, slug: c.slug })),
    (id, slug) => prisma.company.update({ where: { id }, data: { slug } }),
  );
  console.log(`Backfilled job slugs: ${jobCount}, company slugs: ${companyCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
