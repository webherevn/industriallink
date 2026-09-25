import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BRAND_RECRUITER_HOST, BRAND_SITE_HOST } from '@/lib/brand';
import { isCandidatePublicPath, isRecruiterAppPath } from '@/lib/hosts-paths';

function hostnameOf(req: NextRequest): string {
  return req.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
}

export function middleware(req: NextRequest) {
  const host = hostnameOf(req);
  if (host === 'localhost' || host === '127.0.0.1') {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  const isRecruiterHost = host === BRAND_RECRUITER_HOST || host.startsWith('tuyendung.');
  const isPublicHost = host === BRAND_SITE_HOST || host === `www.${BRAND_SITE_HOST}`;

  if (isRecruiterHost) {
    if (pathname === '/' || pathname === '') {
      const dest = req.nextUrl.clone();
      dest.pathname = '/recruiter';
      return NextResponse.redirect(dest);
    }
    if (isCandidatePublicPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_SITE_HOST}${pathname}${search}`);
    }
    return NextResponse.next();
  }

  if (isPublicHost && isRecruiterAppPath(pathname)) {
    return NextResponse.redirect(`https://${BRAND_RECRUITER_HOST}${pathname}${search}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.png|logo.png|robots.txt|sitemap.xml|api/).*)'],
};
