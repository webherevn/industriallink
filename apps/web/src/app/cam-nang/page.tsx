import { cmsPostPublicPath } from '@industriallink/contracts';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { fetchPublicCmsCategories, fetchPublishedCmsPosts } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

export default async function CareerGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [posts, categories] = await Promise.all([
    fetchPublishedCmsPosts({ category }),
    fetchPublicCmsCategories(),
  ]);
  const base = siteUrl();

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${base}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Cẩm nang nghề nghiệp',
        item: `${base}/cam-nang`,
      },
    ],
  };

  return (
    <AppShell allowGuest>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">Cẩm nang nghề nghiệp</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kiến thức, lộ trình và mẹo ứng tuyển cho nhân tài công nghiệp B2B.
        </p>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/cam-nang"
              className={
                !category
                  ? 'rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600'
              }
            >
              Tất cả
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/cam-nang?category=${encodeURIComponent(c.slug)}`}
                className={
                  category === c.slug
                    ? 'rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600'
                }
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {posts.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Đang biên soạn nội dung. Quay lại sớm nhé.
            </li>
          ) : (
            posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={cmsPostPublicPath(post.slug)}
                  className="block rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <h2 className="text-lg font-bold text-slate-900">{post.title}</h2>
                  {post.excerpt && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{post.excerpt}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {post.categoryName ? `${post.categoryName} · ` : ''}
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                      : ''}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </AppShell>
  );
}
