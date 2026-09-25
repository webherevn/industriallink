/** Path helpers dùng chung client + middleware (không đọc window). */

export function isRecruiterAppPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  if (path === '/recruiter' || path.startsWith('/recruiter/')) return true;
  if (path === '/jobs/new' || path.startsWith('/jobs/new/')) return true;
  if (path === '/jobs/manage' || path.startsWith('/jobs/manage/')) return true;
  if (/^\/jobs\/[^/]+\/(edit|applicants|detail)(\/|$)/.test(path)) return true;
  if (path === '/company' || path.startsWith('/company/')) return true;
  if (path === '/search' || path.startsWith('/search/')) return true;
  if (path === '/candidates' || path.startsWith('/candidates/')) return true;
  return false;
}

export function isCandidatePublicPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  const prefixes = [
    '/viec-lam',
    '/cv',
    '/dashboard',
    '/applications',
    '/cam-nang',
    '/cong-ty',
    '/recommended',
    '/progress',
    '/connections',
    '/upload',
    '/analyze',
    '/profile',
    '/notifications',
  ];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}
