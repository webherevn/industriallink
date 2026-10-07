// Patch script: mark all "pending" jobs as published so candidates can apply.
// Reads DATABASE_URL from root .env without printing it.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.resolve(__dirname, '../../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbLine = envContent.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!dbLine) {
  console.error('DATABASE_URL not found in root .env');
  process.exit(1);
}
process.env.DATABASE_URL = dbLine.slice('DATABASE_URL='.length).trim();

const prisma = new PrismaClient();

(async () => {
  const pending = await prisma.job.findMany({
    where: { moderationStatus: 'pending' },
    select: { id: true, title: true, status: true, moderationStatus: true },
  });
  console.log(`Found ${pending.length} pending jobs`);
  for (const j of pending) {
    const r = await prisma.job.update({
      where: { id: j.id },
      data: { status: 'published', publishedAt: new Date(), moderationStatus: 'approved' },
    });
    console.log(`  published: ${r.id} ${r.title}`);
  }
  console.log('Done');
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });