import { buildDefaultRobotsTxt } from '@industriallink/contracts';
import { fetchPublicCmsRobots } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const dynamic = 'force-dynamic';

/** robots.txt động từ CMS (SuperAdmin). Fallback = mặc định hệ thống. */
export async function GET() {
  const cms = await fetchPublicCmsRobots();
  const body = cms?.content?.trim() || buildDefaultRobotsTxt(siteUrl());
  return new Response(body.endsWith('\n') ? body : `${body}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate',
    },
  });
}
