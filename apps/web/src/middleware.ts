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

const CAM_NANG_CACHE_BUST = '3';

function applyNoStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Surrogate-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
}

function nextWithRequestHeaders(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  const pathname = req.nextUrl.pathname;
  // Tránh trình duyệt / CDN giữ HTML cũ của listing blog (từng bị ISR s-maxage=1y).
  if (pathname === '/cam-nang' || pathname.startsWith('/cam-nang/') || pathname === '/') {
    applyNoStore(res);
  }
  // Một lần: xóa HTTP disk-cache trình duyệt (bản /cam-nang trống từng bị cache 1 năm).
  if (!req.cookies.get('il_cd')) {
    res.headers.set('Clear-Site-Data', '"cache"');
    res.cookies.set('il_cd', CAM_NANG_CACHE_BUST, {
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
      sameSite: 'lax',
      secure: true,
    });
  }
  return res;
}

export function middleware(req: NextRequest) {
  const host = hostnameOf(req);
  const { pathname, search } = req.nextUrl;

  // Bust HTML disk-cache cũ: /cam-nang (không query / v cũ) → /cam-nang?v=3
  if (pathname === '/cam-nang' || pathname === '/cam-nang/') {
    const v = req.nextUrl.searchParams.get('v');
    if (v !== CAM_NANG_CACHE_BUST) {
      const dest = req.nextUrl.clone();
      dest.pathname = '/cam-nang';
      dest.searchParams.set('v', CAM_NANG_CACHE_BUST);
      const redirect = NextResponse.redirect(dest, 307);
      applyNoStore(redirect);
      if (!req.cookies.get('il_cd')) {
        redirect.headers.set('Clear-Site-Data', '"cache"');
        redirect.cookies.set('il_cd', CAM_NANG_CACHE_BUST, {
          path: '/',
          maxAge: 60 * 60 * 24 * 400,
          sameSite: 'lax',
          secure: true,
        });
      }
      return redirect;
    }
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    return nextWithRequestHeaders(req);
  }

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
    return nextWithRequestHeaders(req);
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
    return nextWithRequestHeaders(req);
  }

  if (isPublicHost) {
    if (isAdminAppPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_ADMIN_HOST}${pathname}${search}`);
    }
    if (isRecruiterAppPath(pathname)) {
      return NextResponse.redirect(`https://${BRAND_RECRUITER_HOST}${pathname}${search}`);
    }
  }

  return nextWithRequestHeaders(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.png|logo.png|robots.txt|sitemap.xml|api/).*)'],
};
