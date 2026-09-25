import { buildDefaultRobotsTxt } from '@industriallink/contracts';
import { fetchPublicCmsRobots } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

/** robots.txt động từ CMS (SuperAdmin). Fallback = mặc định hệ thống. */
export async function GET() {
  const cms = await fetchPublicCmsRobots();
  const body = cms?.content?.trim() || buildDefaultRobotsTxt(siteUrl());
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
