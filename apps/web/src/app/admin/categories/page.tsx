'use client';

import { cmsCategoryPublicPath, type CmsFaqItem } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { CmsRichEditor } from '@/components/cms-rich-editor';
import { CmsSeoPanel } from '@/components/cms-seo-panel';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createCmsCategory,
  deleteCmsCategory,
  listCmsCategories,
  updateCmsCategory,
  uploadCmsMedia,
} from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import { stripHtml } from '@/lib/cms-seo';

type FormState = {
  editingId: string | null;
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  canonicalPath: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsMaxImagePreview: boolean;
  faq: CmsFaqItem[];
};

const EMPTY_FORM: FormState = {
  editingId: null,
  name: '',
  slug: '',
  description: '',
  avatarUrl: '',
  seoTitle: '',
  seoDescription: '',
  focusKeyword: '',
  canonicalPath: '',
  ogTitle: '',
  ogDescription: '',
  ogImageUrl: '',
  robotsIndex: true,
  robotsFollow: true,
  robotsMaxImagePreview: true,
  faq: [],
};

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cms-categories'],
    queryFn: listCmsCategories,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [ogUploading, setOgUploading] = useState(false);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  function startEdit(id: string) {
    const row = data.find((c) => c.id === id);
    if (!row) return;
    setForm({
      editingId: id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      avatarUrl: row.avatarUrl ?? '',
      seoTitle: row.seoTitle ?? '',
      seoDescription: row.seoDescription ?? '',
      focusKeyword: row.focusKeyword ?? '',
      canonicalPath: row.canonicalPath ?? '',
      ogTitle: row.ogTitle ?? '',
      ogDescription: row.ogDescription ?? '',
      ogImageUrl: row.ogImageUrl ?? '',
      robotsIndex: row.robotsIndex ?? true,
      robotsFollow: row.robotsFollow ?? true,
      robotsMaxImagePreview: row.robotsMaxImagePreview ?? true,
      faq: row.faq?.length ? row.faq.map((f) => ({ ...f })) : [],
    });
    setError(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Chỉ bắt buộc name; phần SEO/avatar/FAQ để trống vẫn lưu được
      const faq = form.faq
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
        .filter((f) => f.question && f.answer);

      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: stripHtml(form.description) ? form.description : null,
        avatarUrl: form.avatarUrl.trim() || null,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        focusKeyword: form.focusKeyword.trim() || null,
        canonicalPath: form.canonicalPath.trim() || null,
        ogTitle: form.ogTitle.trim() || null,
        ogDescription: form.ogDescription.trim() || null,
        ogImageUrl: form.ogImageUrl.trim() || null,
        robotsIndex: form.robotsIndex,
        robotsFollow: form.robotsFollow,
        robotsMaxImagePreview: form.robotsMaxImagePreview,
        faq,
      };
      if (form.editingId) return updateCmsCategory(form.editingId, body);
      return createCmsCategory(body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-categories'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCmsCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-categories'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  async function onUploadAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const res = await uploadCmsMedia(file);
      patch('avatarUrl', res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload avatar thất bại');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onUploadOg(file: File) {
    setOgUploading(true);
    try {
      const res = await uploadCmsMedia(file);
      patch('ogImageUrl', res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload OG thất bại');
    } finally {
      setOgUploading(false);
    }
  }

  const publicPath = cmsCategoryPublicPath(form.slug || 'slug');

  return (
    <AdminShell>
      <h1 className="cms-page-title">Danh mục</h1>
      <p className="cms-page-subtitle">
        Phân loại bài viết cẩm nang — avatar + meta SEO (tương tự bài/trang, không có tác giả).
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">
              {form.editingId ? 'Sửa danh mục' : 'Thêm danh mục'}
            </h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tên">
                  <Input
                    value={form.name}
                    onChange={(e) => patch('name', e.target.value)}
                    required
                  />
                </Field>
                <Field label="Slug (để trống = tự sinh)">
                  <Input value={form.slug} onChange={(e) => patch('slug', e.target.value)} />
                </Field>
              </div>

              <Field label="Avatar danh mục">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {form.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveCmsAssetUrl(form.avatarUrl) || form.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">in</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={form.avatarUrl}
                      onChange={(e) => patch('avatarUrl', e.target.value)}
                      placeholder="URL ảnh hoặc tải lên"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                        {avatarUploading ? 'Đang tải…' : form.avatarUrl ? 'Thay avatar' : 'Tải avatar'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={avatarUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) await onUploadAvatar(file);
                          }}
                        />
                      </label>
                      {form.avatarUrl && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600"
                          onClick={() => patch('avatarUrl', '')}
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Field>

              <CmsCollapsiblePanel title="Mô tả" defaultOpen={Boolean(form.description)}>
                <p className="text-xs text-slate-500">
                  Trình soạn thảo giống bài viết / trang (font, cỡ chữ, định dạng…). Tap tiêu đề
                  panel để thu gọn.
                </p>
                <CmsRichEditor
                  key={form.editingId ?? 'new-category'}
                  value={form.description}
                  onChange={(html) => patch('description', html)}
                  placeholder="Viết mô tả chuyên mục…"
                  compact
                />
              </CmsCollapsiblePanel>

              <CmsCollapsiblePanel title="SEO" defaultOpen>
                <CmsSeoPanel
                  title={form.name}
                  slug={form.slug}
                  publicPath={publicPath}
                  bodyHtml={form.description}
                  excerpt={stripHtml(form.description)}
                  seoTitle={form.seoTitle}
                  seoDescription={form.seoDescription}
                  focusKeyword={form.focusKeyword}
                  coverImageUrl={form.avatarUrl}
                  ogTitle={form.ogTitle}
                  ogDescription={form.ogDescription}
                  ogImageUrl={form.ogImageUrl}
                  robotsIndex={form.robotsIndex}
                  onFocusKeywordChange={(v) => patch('focusKeyword', v)}
                  onSeoTitleChange={(v) => patch('seoTitle', v)}
                  onSeoDescriptionChange={(v) => patch('seoDescription', v)}
                />
                <Field label="Canonical URL">
                  <Input
                    value={form.canonicalPath}
                    onChange={(e) => patch('canonicalPath', e.target.value)}
                    placeholder="Để trống = URL chuyên mục"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Index">
                    <Select
                      value={form.robotsIndex ? 'index' : 'noindex'}
                      onChange={(e) => patch('robotsIndex', e.target.value === 'index')}
                    >
                      <option value="index">Index</option>
                      <option value="noindex">Noindex</option>
                    </Select>
                  </Field>
                  <Field label="Follow">
                    <Select
                      value={form.robotsFollow ? 'follow' : 'nofollow'}
                      onChange={(e) => patch('robotsFollow', e.target.value === 'follow')}
                    >
                      <option value="follow">Follow</option>
                      <option value="nofollow">Nofollow</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.robotsMaxImagePreview}
                    onChange={(e) => patch('robotsMaxImagePreview', e.target.checked)}
                  />
                  max-image-preview:large (Google Discover)
                </label>
              </CmsCollapsiblePanel>

              <CmsCollapsiblePanel title="Open Graph" defaultOpen={false}>
                <Field label="OG Title">
                  <Input
                    value={form.ogTitle}
                    onChange={(e) => patch('ogTitle', e.target.value)}
                    placeholder="Để trống = SEO Title / tên"
                  />
                </Field>
                <Field label="OG Description">
                  <Input
                    value={form.ogDescription}
                    onChange={(e) => patch('ogDescription', e.target.value)}
                    placeholder="Để trống = SEO Description"
                  />
                </Field>
                <Field label="OG Image (1200×630)">
                  <div className="space-y-2">
                    {form.ogImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveCmsAssetUrl(form.ogImageUrl) || form.ogImageUrl}
                        alt="OG"
                        className="max-h-32 w-full rounded border border-slate-200 object-cover"
                      />
                    )}
                    <Input
                      value={form.ogImageUrl}
                      onChange={(e) => patch('ogImageUrl', e.target.value)}
                      placeholder="Để trống = avatar"
                    />
                    <label className="inline-flex cursor-pointer text-xs font-semibold text-brand-600">
                      {ogUploading ? 'Đang tải…' : 'Tải ảnh OG'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={ogUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) await onUploadOg(file);
                        }}
                      />
                    </label>
                  </div>
                </Field>
              </CmsCollapsiblePanel>

              <CmsCollapsiblePanel title="FAQ Schema" defaultOpen={form.faq.length > 0}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">Xuất JSON-LD FAQPage trên trang chuyên mục.</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-600"
                    onClick={() => patch('faq', [...form.faq, { question: '', answer: '' }])}
                  >
                    + Thêm FAQ
                  </button>
                </div>
                {form.faq.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có câu hỏi FAQ.</p>
                ) : (
                  <ul className="space-y-3">
                    {form.faq.map((item, idx) => (
                      <li key={idx} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                        <Input
                          value={item.question}
                          onChange={(e) => {
                            const next = [...form.faq];
                            next[idx] = { ...next[idx], question: e.target.value };
                            patch('faq', next);
                          }}
                          placeholder="Câu hỏi"
                          className="mb-2"
                        />
                        <textarea
                          value={item.answer}
                          onChange={(e) => {
                            const next = [...form.faq];
                            next[idx] = { ...next[idx], answer: e.target.value };
                            patch('faq', next);
                          }}
                          rows={2}
                          placeholder="Câu trả lời"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                        />
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-rose-600"
                          onClick={() => patch('faq', form.faq.filter((_, i) => i !== idx))}
                        >
                          Xoá
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CmsCollapsiblePanel>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                </Button>
                {form.editingId && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Huỷ
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="text-sm font-bold text-slate-900">Danh sách</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
          ) : data.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Chưa có danh mục.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveCmsAssetUrl(c.avatarUrl) || c.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">
                          {c.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-400">/{c.slug}</p>
                      <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        {c.robotsIndex ? 'index' : 'noindex'} · {c.robotsFollow ? 'follow' : 'nofollow'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600"
                      onClick={() => startEdit(c.id)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600"
                      onClick={() => {
                        if (confirm(`Xoá danh mục “${c.name}”?`)) deleteMutation.mutate(c.id);
                      }}
                    >
                      Xoá
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
