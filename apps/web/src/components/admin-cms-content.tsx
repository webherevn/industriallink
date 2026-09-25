'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CmsContentStatus,
  CmsContentType,
  cmsContentPublicPath,
  toSeoSlug,
  type CmsFaqItem,
} from '@industriallink/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

function SeoCharBar({
  label,
  value,
  softLimit,
  hardHint,
}: {
  label: string;
  value: string;
  softLimit: number;
  hardHint: string;
}) {
  const len = value.length;
  const pct = Math.min(100, Math.round((len / softLimit) * 100));
  const over = len > softLimit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={over ? 'font-semibold text-amber-600' : 'text-slate-400'}>
          {len}/{softLimit} · {hardHint}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={over ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [canonicalPath, setCanonicalPath] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [robotsMaxImagePreview, setRobotsMaxImagePreview] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [authorTitle, setAuthorTitle] = useState('');
  const [authorBio, setAuthorBio] = useState('');
  const [faq, setFaq] = useState<CmsFaqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setSlug(existing.slug);
    setSlugTouched(true);
    setExcerpt(existing.excerpt ?? '');
    setBodyHtml(existing.bodyHtml);
    setCategoryId(existing.categoryId ?? '');
    setSeoTitle(existing.seoTitle ?? '');
    setSeoDescription(existing.seoDescription ?? '');
    setCanonicalPath(existing.canonicalPath ?? '');
    setOgTitle(existing.ogTitle ?? '');
    setOgDescription(existing.ogDescription ?? '');
    setOgImageUrl(existing.ogImageUrl ?? '');
    setRobotsIndex(existing.robotsIndex);
    setRobotsFollow(existing.robotsFollow);
    setRobotsMaxImagePreview(existing.robotsMaxImagePreview);
    setAuthorName(existing.authorName ?? '');
    setAuthorTitle(existing.authorTitle ?? '');
    setAuthorBio(existing.authorBio ?? '');
    setFaq(existing.faq ?? []);
  }, [existing]);

  useEffect(() => {
    if (slugTouched || editId) return;
    setSlug(toSeoSlug(title));
  }, [title, slugTouched, editId]);

  const publicPath = useMemo(
    () => cmsContentPublicPath(type, slug || 'slug'),
    [type, slug],
  );

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
        canonicalPath: canonicalPath || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null,
        ogImageUrl: ogImageUrl || null,
        robotsIndex,
        robotsFollow,
        robotsMaxImagePreview,
        authorName: authorName || null,
        authorTitle: authorTitle || null,
        authorBio: authorBio || null,
        faq,
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <Field label="Tiêu đề (H1)">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </Field>
            <Field label="URL slug">
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="Tự sinh từ H1 (bỏ dấu)"
              />
              <p className="mt-1 text-[11px] text-slate-400">{publicPath}</p>
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
            <Field label="Nội dung HTML (đã sanitize khi lưu)">
              <textarea
                className="min-h-[260px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">FAQ Schema (FAQPage)</h2>
            {faq.map((item, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-slate-100 p-3">
                <Input
                  placeholder="Câu hỏi"
                  value={item.question}
                  onChange={(e) => {
                    const next = [...faq];
                    next[idx] = { ...next[idx]!, question: e.target.value };
                    setFaq(next);
                  }}
                />
                <Input
                  placeholder="Câu trả lời"
                  value={item.answer}
                  onChange={(e) => {
                    const next = [...faq];
                    next[idx] = { ...next[idx]!, answer: e.target.value };
                    setFaq(next);
                  }}
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600"
                  onClick={() => setFaq(faq.filter((_, i) => i !== idx))}
                >
                  Xoá cặp FAQ
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setFaq([...faq, { question: '', answer: '' }])}
            >
              + Thêm FAQ
            </Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">SEO Meta</h2>
            <SeoCharBar label="SEO Title" value={seoTitle} softLimit={60} hardHint="~580px" />
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Để trống = dùng H1"
            />
            <SeoCharBar
              label="SEO Description"
              value={seoDescription}
              softLimit={155}
              hardHint="~920px"
            />
            <Input
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Meta description"
            />
            <Field label="Canonical URL (để trống = URL hiện tại)">
              <Input
                value={canonicalPath}
                onChange={(e) => setCanonicalPath(e.target.value)}
                placeholder="/cam-nang/slug hoặc https://..."
              />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Meta Robots</h2>
            <Field label="Index">
              <Select
                value={robotsIndex ? 'index' : 'noindex'}
                onChange={(e) => setRobotsIndex(e.target.value === 'index')}
              >
                <option value="index">Index</option>
                <option value="noindex">Noindex</option>
              </Select>
            </Field>
            <Field label="Follow">
              <Select
                value={robotsFollow ? 'follow' : 'nofollow'}
                onChange={(e) => setRobotsFollow(e.target.value === 'follow')}
              >
                <option value="follow">Follow</option>
                <option value="nofollow">Nofollow</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={robotsMaxImagePreview}
                onChange={(e) => setRobotsMaxImagePreview(e.target.checked)}
              />
              Max-image-preview:large (Google Discover)
            </label>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Open Graph</h2>
            <Field label="OG Title">
              <Input value={ogTitle} onChange={(e) => setOgTitle(e.target.value)} />
            </Field>
            <Field label="OG Description">
              <Input value={ogDescription} onChange={(e) => setOgDescription(e.target.value)} />
            </Field>
            <Field label="OG Image URL (1200×630)">
              <Input value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Tác giả (Person / E-E-A-T)</h2>
            <Field label="Tên chuyên gia">
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </Field>
            <Field label="Chức danh">
              <Input value={authorTitle} onChange={(e) => setAuthorTitle(e.target.value)} />
            </Field>
            <Field label="Bio ngắn">
              <Input value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} />
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
            {isPage ? 'Trang tĩnh (/trang/slug)' : 'Cẩm nang (/cam-nang/slug)'} · SEO meta chuẩn
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
                <th className="pb-2 font-semibold">Index</th>
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
                  <td className="py-3 text-xs text-slate-500">
                    {row.robotsIndex ? 'index' : 'noindex'}
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
