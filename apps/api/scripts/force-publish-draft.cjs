// Patch all 'draft' jobs to 'published' (status + moderationStatus='approved_auto').
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const envContent = fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
const dbLine = envContent.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
process.env.DATABASE_URL = dbLine.slice('DATABASE_URL='.length).trim();
const prisma = new PrismaClient();
(async () => {
  const drafts = await prisma.job.findMany({
    where: { status: { not: 'published' } },
    select: { id: true, title: true, status: true, moderationStatus: true },
  });
  console.log(`Found ${drafts.length} non-published jobs`);
  for (const j of drafts) {
    await prisma.job.update({
      where: { id: j.id },
      data: { status: 'published', publishedAt: new Date(), moderationStatus: 'approved_auto' },
    });
    console.log(`  published: ${j.id} ${j.title}`);
  }
  console.log('Done');
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });