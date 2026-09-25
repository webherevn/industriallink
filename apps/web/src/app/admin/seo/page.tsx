'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui';
import { fetchCmsOverview } from '@/lib/admin-cms';

export default function AdminSeoOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-overview'],
    queryFn: fetchCmsOverview,
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-slate-900">SEO overview</h1>
      <p className="mt-1 text-sm text-slate-500">
        Theo dõi số lượng nội dung indexable. Meta SEO chỉnh trong từng post/page/category.
      </p>
      <Card className="mt-6 space-y-3">
        <p className="text-sm text-slate-700">
          Bài viết published:{' '}
          <b>{isLoading ? '…' : data?.publishedPosts ?? 0}</b> — URL dạng{' '}
          <code className="text-xs">/cam-nang/&#123;slug&#125;</code>
        </p>
        <p className="text-sm text-slate-700">
          Trang published: <b>{isLoading ? '…' : data?.publishedPages ?? 0}</b> — URL dạng{' '}
          <code className="text-xs">/trang/&#123;slug&#125;</code>
        </p>
        <p className="text-sm text-slate-700">
          Danh mục: <b>{isLoading ? '…' : data?.categories ?? 0}</b>
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/admin/posts" className="text-sm font-semibold text-brand-600">
            Quản lý bài viết →
          </Link>
          <Link href="/admin/pages" className="text-sm font-semibold text-brand-600">
            Quản lý trang →
          </Link>
          <Link href="/admin/categories" className="text-sm font-semibold text-brand-600">
            Quản lý danh mục →
          </Link>
        </div>
      </Card>
    </AdminShell>
  );
}
