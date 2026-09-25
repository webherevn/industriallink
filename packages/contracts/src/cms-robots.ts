/**
 * Nội dung robots.txt mặc định (khi SuperAdmin chưa lưu bản custom).
 * Đồng bộ với quy tắc SEO public của inlink.
 */
export function buildDefaultRobotsTxt(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `# inlink robots.txt
User-agent: *
Allow: /
Allow: /viec-lam
Allow: /viec-lam/
Allow: /cong-ty/
Allow: /cam-nang
Allow: /cam-nang/
Allow: /trang/
Allow: /tac-gia/

Disallow: /login
Disallow: /register
Disallow: /search
Disallow: /dashboard
Disallow: /account
Disallow: /profile
Disallow: /company
Disallow: /companies
Disallow: /recruiter
Disallow: /admin
Disallow: /candidates
Disallow: /cv
Disallow: /applications
Disallow: /connections
Disallow: /progress
Disallow: /recommended
Disallow: /notifications
Disallow: /upload
Disallow: /analyze
Disallow: /jobs
Disallow: /jobs/
Disallow: /?*
Disallow: /viec-lam?*
Disallow: /cam-nang?*
Disallow: /*?*keyword=
Disallow: /*?*industry=
Disallow: /*?*subIndustry=
Disallow: /*?*role=
Disallow: /*?*location=
Disallow: /*?*locations=
Disallow: /*?*salary=
Disallow: /*?*experienceBand=
Disallow: /*?*jobLevel=
Disallow: /*?*jobTrack=
Disallow: /*?*company=
Disallow: /*?*tab=
Disallow: /*?*page=
Disallow: /*?*q=
Disallow: /*?*jobId=

Sitemap: ${base}/sitemap/main.xml
Sitemap: ${base}/sitemap/jobs.xml
Sitemap: ${base}/sitemap/blog.xml
Sitemap: ${base}/sitemap/pages.xml
`;
}
