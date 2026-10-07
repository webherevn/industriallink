const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
const dbLine = envContent.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
process.env.DATABASE_URL = dbLine.slice('DATABASE_URL='.length).trim();
const prisma = new PrismaClient();
(async () => {
  const all = await prisma.job.findMany({
    select: { id: true, moderationStatus: true, status: true, title: true },
  });
  console.log(`Total jobs: ${all.length}`);
  console.log('First 5:');
  console.log(JSON.stringify(all.slice(0, 5), null, 2));
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });