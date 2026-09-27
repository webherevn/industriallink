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

function applyNoStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Surrogate-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function nextWithRequestHeaders(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // Mọi HTML đi qua middleware. File /_next/static đã bị loại khỏi matcher nên vẫn cache theo hash.
  return applyNoStore(res);
}

export function middleware(req: NextRequest) {
  const host = hostnameOf(req);
  const { pathname, search } = req.nextUrl;

  // Đường cũ /cam-nang/chuyen-muc/{slug} → /cam-nang/{slug}
  const legacyCategory = pathname.match(
    /^\/cam-nang\/chuyen-muc\/([^/]+)(?:\/page\/(\d+))?\/?$/,
  );
  if (legacyCategory) {
    const slug = decodeURIComponent(legacyCategory[1]);
    const page = legacyCategory[2] ? Number(legacyCategory[2]) : 1;
    const dest = req.nextUrl.clone();
    dest.pathname =
      Number.isFinite(page) && page > 1
        ? `/cam-nang/${slug}/page/${Math.floor(page)}`
        : `/cam-nang/${slug}`;
    return applyNoStore(NextResponse.redirect(dest, 301));
  }

  // SEO: gộp /cam-nang?v=* về URL sạch /cam-nang (bỏ cache-bust query tạm thời).
  if (
    (pathname === '/cam-nang' || pathname === '/cam-nang/') &&
    req.nextUrl.searchParams.has('v')
  ) {
    const dest = req.nextUrl.clone();
    dest.pathname = '/cam-nang';
    dest.searchParams.delete('v');
    const redirect = NextResponse.redirect(dest, 301);
    return applyNoStore(redirect);
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
      return applyNoStore(NextResponse.redirect(dest));
    }
    if (!isAdminAppPath(pathname) && pathname !== '/login') {
      if (isCandidatePublicPath(pathname) || isRecruiterAppPath(pathname)) {
        return applyNoStore(NextResponse.redirect(`https://${BRAND_SITE_HOST}${pathname}${search}`));
      }
      const dest = req.nextUrl.clone();
      dest.pathname = '/admin';
      return applyNoStore(NextResponse.redirect(dest));
    }
    return nextWithRequestHeaders(req);
  }

  if (isRecruiterHost) {
    if (pathname === '/' || pathname === '') {
      const dest = req.nextUrl.clone();
      dest.pathname = '/recruiter';
      return applyNoStore(NextResponse.redirect(dest));
    }
    if (isAdminAppPath(pathname)) {
      return applyNoStore(NextResponse.redirect(`https://${BRAND_ADMIN_HOST}${pathname}${search}`));
    }
    if (isCandidatePublicPath(pathname)) {
      return applyNoStore(NextResponse.redirect(`https://${BRAND_SITE_HOST}${pathname}${search}`));
    }
    return nextWithRequestHeaders(req);
  }

  if (isPublicHost) {
    if (isAdminAppPath(pathname)) {
      return applyNoStore(NextResponse.redirect(`https://${BRAND_ADMIN_HOST}${pathname}${search}`));
    }
    if (isRecruiterAppPath(pathname)) {
      return applyNoStore(NextResponse.redirect(`https://${BRAND_RECRUITER_HOST}${pathname}${search}`));
    }
  }

  return nextWithRequestHeaders(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.png|logo.png|robots.txt|sitemap.xml|api/).*)'],
};
