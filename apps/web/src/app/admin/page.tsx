'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui';
import { fetchCmsOverview } from '@/lib/admin-cms';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-overview'],
    queryFn: fetchCmsOverview,
  });

  return (
    <AdminShell>
      <h1 className="cms-page-title">Dashboard</h1>
      <p className="cms-page-subtitle">
        Superadmin — CMS & SEO. Module nền tảng mở dần.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Danh mục', value: data?.categories, href: '/admin/categories' },
          { label: 'Bài viết', value: data?.posts, href: '/admin/posts' },
          { label: 'Trang', value: data?.pages, href: '/admin/pages' },
          { label: 'Post đã xuất bản', value: data?.publishedPosts, href: '/admin/posts' },
          { label: 'Page đã xuất bản', value: data?.publishedPages, href: '/admin/pages' },
          { label: 'Bản nháp', value: data?.drafts, href: '/admin/posts' },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="transition hover:border-brand-200 hover:shadow-md">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-brand-600">
                {isLoading ? '…' : (item.value ?? 0)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
