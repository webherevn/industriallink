'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CmsContentStatus,
  CmsContentType,
  cmsContentPublicPath,
} from '@industriallink/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createCmsPost,
  deleteCmsPost,
  getCmsPostAdmin,
  listCmsCategories,
  listCmsPostsAdmin,
  setCmsPostStatus,
  updateCmsPost,
} from '@/lib/admin-cms';

function ContentEditor({
  type,
  editId,
}: {
  type: CmsContentType;
  editId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const isPage = type === CmsContentType.Page;
  const listPath = isPage ? '/admin/pages' : '/admin/posts';

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-cms-categories'],
    queryFn: listCmsCategories,
    enabled: !isPage,
  });

  const { data: existing } = useQuery({
    queryKey: ['admin-cms-post', editId],
    queryFn: () => getCmsPostAdmin(editId!),
    enabled: Boolean(editId),
  });

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [robots, setRobots] = useState('index,follow');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setSlug(existing.slug);
    setExcerpt(existing.excerpt ?? '');
    setBodyHtml(existing.bodyHtml);
    setCategoryId(existing.categoryId ?? '');
    setSeoTitle(existing.seoTitle ?? '');
    setSeoDescription(existing.seoDescription ?? '');
    setOgImageUrl(existing.ogImageUrl ?? '');
    setRobots(existing.robots || 'index,follow');
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const body = {
        type,
        title,
        slug: slug || undefined,
        excerpt: excerpt || null,
        bodyHtml,
        categoryId: isPage ? null : categoryId || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        ogImageUrl: ogImageUrl || null,
        robots,
        publish,
      };
      if (editId) return updateCmsPost(editId, body);
      return createCmsPost(body);
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
      if (!editId) router.replace(`${listPath}/${saved.id}`);
      else setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {editId ? 'Sửa' : 'Tạo'} {isPage ? 'trang' : 'bài viết'}
          </h1>
          {existing && (
            <p className="mt-1 text-xs text-slate-400">
              Public:{' '}
              <a
                className="text-brand-600"
                href={cmsContentPublicPath(type, existing.slug)}
                target="_blank"
                rel="noreferrer"
              >
                {cmsContentPublicPath(type, existing.slug)}
              </a>
            </p>
          )}
        </div>
        <Link href={listPath} className="text-sm font-semibold text-slate-600">
          ← Danh sách
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-3">
          <Field label="Tiêu đề">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Để trống = tự sinh" />
          </Field>
          <Field label="Tóm tắt">
            <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </Field>
          {!isPage && (
            <Field label="Danh mục">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Không chọn —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Nội dung HTML">
            <textarea
              className="min-h-[280px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>Nội dung...</p>"
            />
          </Field>
          {bodyHtml && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Preview</p>
              <div
                className="prose prose-sm max-w-none text-slate-800"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">SEO</h2>
            <Field label="SEO title">
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </Field>
            <Field label="SEO description">
              <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
            </Field>
            <Field label="OG image URL">
              <Input value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} />
            </Field>
            <Field label="Robots">
              <Select value={robots} onChange={(e) => setRobots(e.target.value)}>
                <option value="index,follow">index,follow</option>
                <option value="noindex,nofollow">noindex,nofollow</option>
              </Select>
            </Field>
          </Card>

          <Card className="space-y-2">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              className="w-full"
              disabled={saveMutation.isPending || !title.trim()}
              onClick={() => saveMutation.mutate(false)}
            >
              Lưu nháp
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              disabled={saveMutation.isPending || !title.trim()}
              onClick={() => saveMutation.mutate(true)}
            >
              Lưu & xuất bản
            </Button>
            {existing && (
              <p className="text-center text-xs text-slate-400">
                Trạng thái: <b>{existing.status}</b>
              </p>
            )}
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function ContentList({ type }: { type: CmsContentType }) {
  const qc = useQueryClient();
  const isPage = type === CmsContentType.Page;
  const base = isPage ? '/admin/pages' : '/admin/posts';

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cms-posts', type],
    queryFn: () => listCmsPostsAdmin({ type }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CmsContentStatus }) =>
      setCmsPostStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCmsPost,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isPage ? 'Trang' : 'Bài viết'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isPage ? 'Trang tĩnh (/trang/slug)' : 'Cẩm nang nghề nghiệp (/cam-nang/slug)'}
          </p>
        </div>
        <Link href={`${base}/new`}>
          <Button>Tạo mới</Button>
        </Link>
      </div>

      <Card className="mt-6 overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có nội dung.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="pb-2 font-semibold">Tiêu đề</th>
                <th className="pb-2 font-semibold">Slug</th>
                <th className="pb-2 font-semibold">Trạng thái</th>
                <th className="pb-2 font-semibold">Cập nhật</th>
                <th className="pb-2 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 font-medium text-slate-900">{row.title}</td>
                  <td className="py-3 text-slate-500">{row.slug}</td>
                  <td className="py-3">
                    <span
                      className={
                        row.status === CmsContentStatus.Published
                          ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700'
                          : 'rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700'
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-slate-400">
                    {new Date(row.updatedAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`${base}/${row.id}`} className="text-xs font-semibold text-brand-600">
                        Sửa
                      </Link>
                      {row.status !== CmsContentStatus.Published ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-600"
                          onClick={() =>
                            statusMutation.mutate({
                              id: row.id,
                              status: CmsContentStatus.Published,
                            })
                          }
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-semibold text-amber-600"
                          onClick={() =>
                            statusMutation.mutate({ id: row.id, status: CmsContentStatus.Draft })
                          }
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600"
                        onClick={() => {
                          if (confirm(`Xoá “${row.title}”?`)) deleteMutation.mutate(row.id);
                        }}
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}

export function AdminPostsListPage() {
  return <ContentList type={CmsContentType.Post} />;
}

export function AdminPagesListPage() {
  return <ContentList type={CmsContentType.Page} />;
}

export function AdminPostEditorPage({ editId }: { editId?: string }) {
  return <ContentEditor type={CmsContentType.Post} editId={editId} />;
}

export function AdminPageEditorPage({ editId }: { editId?: string }) {
  return <ContentEditor type={CmsContentType.Page} editId={editId} />;
}
