'use client';

import { useQuery } from '@tanstack/react-query';
import { CmsContentStatus, CmsContentType, type CmsPostView } from '@industriallink/contracts';
import Link from 'next/link';
import { useMemo } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsTableOfContents } from '@/components/cms-toc';
import { getCmsPostAdmin } from '@/lib/admin-cms';
import { ApiError } from '@/lib/api';
import { absolutizeCmsHtml, resolveCmsAssetUrl } from '@/lib/cms-assets';
import { prepareCmsBodyHtml } from '@/lib/cms-seo';

function previewNote(post: CmsPostView): string {
  const future =
    post.status === CmsContentStatus.Published &&
    post.publishedAt &&
    new Date(post.publishedAt).getTime() > Date.now();
  if (future && post.publishedAt) {
    return `Hẹn giờ — khách chưa thấy. Công khai lúc ${new Date(post.publishedAt).toLocaleString('vi-VN')}.`;
  }
  if (post.status === CmsContentStatus.Published) {
    return 'Đang xuất bản. Đây là bản đã lưu, không gồm chỉnh sửa chưa bấm Cập nhật.';
  }
  if (post.status === CmsContentStatus.Archived) {
    return 'Đang lưu trữ — khách không thấy trang này.';
  }
  return 'Bản nháp — khách không thấy. Xem trước bản đã lưu.';
}

function PreviewArticle({ post }: { post: CmsPostView }) {
  const prepared = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const raw = absolutizeCmsHtml(post.bodyHtml);
    return prepareCmsBodyHtml(raw, {
      siteOrigin: origin,
      firstImageEager: !post.coverImageUrl,
    });
  }, [post.bodyHtml, post.coverImageUrl]);

  const editHref =
    post.type === CmsContentType.Page ? `/admin/pages/${post.id}` : `/admin/posts/${post.id}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-900">{previewNote(post)}</p>
        <Link href={editHref} className="text-sm font-semibold text-brand-700 hover:underline">
          Quay lại soạn
        </Link>
      </div>
      <article className="rounded-xl border border-slate-200 bg-white px-5 py-6 sm:px-8">
        {post.categoryName ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {post.categoryName}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{post.title}</h1>
        {post.excerpt ? <p className="mt-3 text-base text-slate-600">{post.excerpt}</p> : null}
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveCmsAssetUrl(post.coverImageUrl) || post.coverImageUrl}
            alt=""
            className="mt-6 aspect-[2/1] w-full rounded-xl object-cover"
          />
        ) : null}
        {prepared.toc.length >= 2 ? (
          <div className="mt-6">
            <CmsTableOfContents items={prepared.toc} />
          </div>
        ) : null}
        <div
          className="cms-prose mt-6 max-w-none"
          dangerouslySetInnerHTML={{ __html: prepared.html }}
        />
      </article>
    </div>
  );
}

export function AdminCmsPreviewPage({ id }: { id: string }) {
  const { data: post, isLoading, error } = useQuery({
    queryKey: ['admin-cms-preview', id],
    queryFn: () => getCmsPostAdmin(id),
  });

  return (
    <AdminShell>
      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải bản xem trước…</p>
      ) : error || !post ? (
        <p className="text-sm text-red-600">
          {error instanceof ApiError ? error.message : 'Không xem trước được nội dung này.'}
        </p>
      ) : (
        <PreviewArticle post={post} />
      )}
    </AdminShell>
  );
}
