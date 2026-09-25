import { UserRole } from '@industriallink/contracts';
import { handoffHashForToken, tokenStore } from './api';
import {
  BRAND_RECRUITER_HOST,
  BRAND_RECRUITER_SITE_URL,
  BRAND_SITE_HOST,
  BRAND_SITE_URL,
} from './brand';
import { isRecruiterAppPath } from './hosts-paths';

export { isCandidatePublicPath, isRecruiterAppPath } from './hosts-paths';

export function currentHostname(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

export function isBrowserLocalHost(hostname = currentHostname()): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
}

export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || BRAND_SITE_URL).replace(/\/$/, '');
}

export function recruiterSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_RECRUITER_SITE_URL || BRAND_RECRUITER_SITE_URL).replace(
    /\/$/,
    '',
  );
}

export function isRecruiterHostname(hostname = currentHostname()): boolean {
  return hostname === BRAND_RECRUITER_HOST || hostname.startsWith('tuyendung.');
}

export function isPublicHostname(hostname = currentHostname()): boolean {
  return hostname === BRAND_SITE_HOST || hostname === `www.${BRAND_SITE_HOST}`;
}

/** Local/dev: một origin, không nhảy domain. */
export function shouldUseRecruiterHost(hostname = currentHostname()): boolean {
  return !isBrowserLocalHost(hostname);
}

function withPath(origin: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${p}`;
}

export function goToRecruiterApp(path = '/recruiter'): void {
  const destPath = path.startsWith('/') ? path : `/${path}`;
  const handoff = handoffHashForToken(tokenStore.get());
  if (!shouldUseRecruiterHost()) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  const origin = recruiterSiteUrl();
  if (window.location.origin === origin) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  window.location.replace(`${withPath(origin, destPath)}${handoff}`);
}

export function goToPublicApp(path = '/'): void {
  const destPath = path.startsWith('/') ? path : `/${path}`;
  const handoff = handoffHashForToken(tokenStore.get());
  if (!shouldUseRecruiterHost()) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  const origin = publicSiteUrl();
  if (window.location.origin === origin) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  window.location.replace(`${withPath(origin, destPath)}${handoff}`);
}

export function navigateAfterLogin(role: UserRole, nextPath?: string | null): void {
  if (role === UserRole.Candidate) {
    const dest = nextPath || '/dashboard';
    if (shouldUseRecruiterHost() && isRecruiterHostname()) {
      goToPublicApp(dest);
      return;
    }
    window.location.assign(dest);
    return;
  }
  const dest =
    nextPath && isRecruiterAppPath(nextPath) ? nextPath : '/recruiter';
  goToRecruiterApp(dest);
}

/** Trả true nếu đã bắt đầu chuyển host — caller không render tiếp. */
export function bounceIfWrongHost(role: UserRole, pathWithSearch: string): boolean {
  if (!shouldUseRecruiterHost()) return false;
  if (role !== UserRole.Candidate && isPublicHostname()) {
    const dest = isRecruiterAppPath(pathWithSearch) ? pathWithSearch : '/recruiter';
    goToRecruiterApp(dest);
    return true;
  }
  if (role === UserRole.Candidate && isRecruiterHostname()) {
    const dest = isRecruiterAppPath(pathWithSearch) ? '/dashboard' : pathWithSearch;
    goToPublicApp(dest || '/dashboard');
    return true;
  }
  return false;
}
