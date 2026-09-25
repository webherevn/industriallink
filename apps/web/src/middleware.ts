import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { BRAND_ADMIN_HOST, BRAND_RECRUITER_HOST, BRAND_SITE_HOST } from '@/lib/brand';
import {
  isAdminAppPath,
  isCandidatePublicPath,
  isRecruiterAppPath,
} from '@/lib/hosts-paths';

function hostnameOf(req: NextRequest): string {
  return req.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
}

export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);

  const host = hostnameOf(req);
  if (host === 'localhost' || host === '127.0.0.1') {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const { pathname, search } = req.nextUrl;
  const isRecruiterHost = host === BRAND_RECRUITER_HOST || host.startsWith('tuyendung.');
  const isAdminHost = host === BRAND_ADMIN_HOST || host.startsWith('admin.');
  const isPublicHost = host === BRAND_SITE_HOST || host === `www.${BRAND_SITE_HOST}`;

  if (isAdminHost) {
    if (pathname === '/' || pathname === '') {
      const dest = req.nextUrl.clone();
      dest.pathname = '/admin';
      return NextResponse.redirect(dest);
    }
    if (!isAdminAppPath(pathname) && pathname !== '/login') {
      if (isCandidatePublicPath(pathname) || isRecruiterAppPath(pathname)) {
        return NextResponse.redirect(`https://${BRAND_SITE_HOST}${pathname}${search}`);
      }
      const dest = req.nextUrl.clone();
      dest.pathname = '/admin';
      return NextResponse.redirect(dest);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isRecruiterHost) {
    if (pathname === '/' || pathname === '') {
      const dest = req.nextUrl.clone();
      dest.pathname = '/recruiter';
      return NextResponse.redirect(dest);
    }
    if (isAdminAppPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_ADMIN_HOST}${pathname}${search}`);
    }
    if (isCandidatePublicPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_SITE_HOST}${pathname}${search}`);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isPublicHost) {
    if (isAdminAppPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_ADMIN_HOST}${pathname}${search}`);
    }
    if (isRecruiterAppPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_RECRUITER_HOST}${pathname}${search}`);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.png|logo.png|robots.txt|sitemap.xml|api/).*)'],
};
