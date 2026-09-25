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
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Khung Superadmin — CMS & SEO phase 1. Module nền tảng sẽ mở dần.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Danh mục', value: data?.categories, href: '/admin/categories' },
          { label: 'Bài viết', value: data?.posts, href: '/admin/posts' },
          { label: 'Trang', value: data?.pages, href: '/admin/pages' },
          { label: 'Post đã xuất bản', value: data?.publishedPosts, href: '/admin/posts' },
          { label: 'Page đã xuất bản', value: data?.publishedPages, href: '/admin/pages' },
          { label: 'Bản nháp', value: data?.drafts, href: '/admin/posts' },
        ].map((item) => (
          <Link key={item.label} href={item.href}>
            <Card className="transition hover:border-slate-300 hover:shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {isLoading ? '…' : (item.value ?? 0)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
