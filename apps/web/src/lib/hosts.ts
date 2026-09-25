import { UserRole } from '@industriallink/contracts';
import { handoffHashForToken, tokenStore } from './api';
import {
  BRAND_ADMIN_HOST,
  BRAND_ADMIN_SITE_URL,
  BRAND_RECRUITER_HOST,
  BRAND_RECRUITER_SITE_URL,
  BRAND_SITE_HOST,
  BRAND_SITE_URL,
} from './brand';
import { isAdminAppPath, isRecruiterAppPath } from './hosts-paths';

export { isAdminAppPath, isCandidatePublicPath, isRecruiterAppPath } from './hosts-paths';

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

export function adminSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_SITE_URL || BRAND_ADMIN_SITE_URL).replace(/\/$/, '');
}

export function isRecruiterHostname(hostname = currentHostname()): boolean {
  return hostname === BRAND_RECRUITER_HOST || hostname.startsWith('tuyendung.');
}

export function isAdminHostname(hostname = currentHostname()): boolean {
  return hostname === BRAND_ADMIN_HOST || hostname.startsWith('admin.');
}

export function isPublicHostname(hostname = currentHostname()): boolean {
  return hostname === BRAND_SITE_HOST || hostname === `www.${BRAND_SITE_HOST}`;
}

/** Local/dev: một origin, không nhảy domain. */
export function shouldUseSplitHosts(hostname = currentHostname()): boolean {
  return !isBrowserLocalHost(hostname);
}

function withPath(origin: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${p}`;
}

function navigateToOrigin(origin: string, path: string): void {
  const destPath = path.startsWith('/') ? path : `/${path}`;
  const handoff = handoffHashForToken(tokenStore.get());
  if (!shouldUseSplitHosts()) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  if (window.location.origin === origin) {
    window.location.replace(`${destPath}${handoff}`);
    return;
  }
  window.location.replace(`${withPath(origin, destPath)}${handoff}`);
}

export function goToRecruiterApp(path = '/recruiter'): void {
  navigateToOrigin(recruiterSiteUrl(), path);
}

export function goToAdminApp(path = '/admin'): void {
  navigateToOrigin(adminSiteUrl(), path);
}

export function goToPublicApp(path = '/'): void {
  navigateToOrigin(publicSiteUrl(), path);
}

export function navigateAfterLogin(role: UserRole, nextPath?: string | null): void {
  if (role === UserRole.SuperAdmin) {
    const dest = nextPath && isAdminAppPath(nextPath) ? nextPath : '/admin';
    // Đã ở admin.inlink.vn → ở lại origin hiện tại (tránh nhảy nhầm host)
    if (isAdminHostname()) {
      window.location.assign(dest);
      return;
    }
    goToAdminApp(dest);
    return;
  }
  if (role === UserRole.Candidate) {
    const dest = nextPath || '/dashboard';
    if (shouldUseSplitHosts() && (isRecruiterHostname() || isAdminHostname())) {
      goToPublicApp(dest);
      return;
    }
    window.location.assign(dest);
    return;
  }
  // Recruiter / CompanyAdmin / HiringManager
  const dest = nextPath && isRecruiterAppPath(nextPath) ? nextPath : '/recruiter';
  if (isRecruiterHostname()) {
    window.location.assign(dest);
    return;
  }
  goToRecruiterApp(dest);
}

/** Trả true nếu đã bắt đầu chuyển host — caller không render tiếp. */
export function bounceIfWrongHost(role: UserRole, pathWithSearch: string): boolean {
  if (!shouldUseSplitHosts()) return false;

  if (role === UserRole.SuperAdmin) {
    if (!isAdminHostname()) {
      const dest = isAdminAppPath(pathWithSearch) ? pathWithSearch : '/admin';
      goToAdminApp(dest);
      return true;
    }
    return false;
  }

  if (isAdminHostname()) {
    if (role === UserRole.Candidate) {
      goToPublicApp('/dashboard');
      return true;
    }
    goToRecruiterApp('/recruiter');
    return true;
  }

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
