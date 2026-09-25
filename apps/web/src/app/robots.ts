import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/brand';

/** Chỉ URL công khai được crawl. Bộ lọc động và khu vực tài khoản bị chặn. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || BRAND_SITE_URL;
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/viec-lam', '/viec-lam/', '/cong-ty/', '/cam-nang', '/cam-nang/', '/trang/'],
      disallow: [
        '/login',
        '/register',
        '/search',
        '/dashboard',
        '/account',
        '/profile',
        '/company',
        '/companies',
        '/recruiter',
        '/admin',
        '/candidates',
        '/cv',
        '/applications',
        '/connections',
        '/progress',
        '/recommended',
        '/notifications',
        '/upload',
        '/analyze',
        '/jobs',
        '/jobs/',
        '/?*',
        '/viec-lam?*',
        '/cam-nang?*',
        '/*?*keyword=',
        '/*?*industry=',
        '/*?*subIndustry=',
        '/*?*role=',
        '/*?*location=',
        '/*?*locations=',
        '/*?*salary=',
        '/*?*experienceBand=',
        '/*?*jobLevel=',
        '/*?*jobTrack=',
        '/*?*company=',
        '/*?*tab=',
        '/*?*page=',
        '/*?*q=',
        '/*?*jobId=',
      ],
    },
    sitemap: [
      `${base}/sitemap/main.xml`,
      `${base}/sitemap/jobs.xml`,
      `${base}/sitemap/blog.xml`,
      `${base}/sitemap/pages.xml`,
    ],
  };
}
