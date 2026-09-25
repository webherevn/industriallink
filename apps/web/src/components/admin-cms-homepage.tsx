'use client';

import type {
  CmsHomepageSettingsView,
  UpsertCmsHomepageSettingsRequest,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ImageIcon, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getCmsHomepageAdmin, saveCmsHomepageAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import { BRAND_NAME } from '@/lib/brand';

type FormState = UpsertCmsHomepageSettingsRequest;

const DEFAULTS: FormState = {
  heading: 'Tìm đúng cơ hội trong ngành công nghiệp',
  headingAccent: 'ngành công nghiệp',
  subtitle:
    'Hàng nghìn cơ hội việc làm từ các doanh nghiệp uy tín trong lĩnh vực kỹ thuật, sản xuất, vận hành và kinh doanh B2B.',
  seoTitle: `${BRAND_NAME} — Kết nối nhân tài, dẫn lối công nghiệp`,
  seoDescription:
    'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa. Kết nối nhân tài công nghiệp B2B trên inlink.',
  focusKeyword: 'việc làm công nghiệp',
  canonicalPath: '/',
  ogTitle: '',
  ogDescription: '',
  ogImageUrl: '',
  robotsIndex: true,
  robotsFollow: true,
  robotsMaxImagePreview: true,
};

function fromView(v: CmsHomepageSettingsView): FormState {
  return {
    heading: v.heading,
    headingAccent: v.headingAccent ?? '',
    subtitle: v.subtitle ?? '',
    seoTitle: v.seoTitle ?? '',
    seoDescription: v.seoDescription ?? '',
    focusKeyword: v.focusKeyword ?? '',
    canonicalPath: v.canonicalPath ?? '/',
    ogTitle: v.ogTitle ?? '',
    ogDescription: v.ogDescription ?? '',
    ogImageUrl: v.ogImageUrl ?? '',
    robotsIndex: v.robotsIndex,
    robotsFollow: v.robotsFollow,
    robotsMaxImagePreview: v.robotsMaxImagePreview,
  };
}

function toPayload(form: FormState): UpsertCmsHomepageSettingsRequest {
  const t = (v?: string | null) => (v?.trim() ? v.trim() : null);
  return {
    heading: (form.heading || '').trim(),
    headingAccent: t(form.headingAccent),
    subtitle: t(form.subtitle),
    seoTitle: t(form.seoTitle),
    seoDescription: t(form.seoDescription),
    focusKeyword: t(form.focusKeyword),
    canonicalPath: t(form.canonicalPath) || '/',
    ogTitle: t(form.ogTitle),
    ogDescription: t(form.ogDescription),
    ogImageUrl: t(form.ogImageUrl),
    robotsIndex: form.robotsIndex ?? true,
    robotsFollow: form.robotsFollow ?? true,
    robotsMaxImagePreview: form.robotsMaxImagePreview ?? true,
  };
}

function CharCount({ value, soft }: { value: string; soft: number }) {
  const n = value.length;
  return (
    <span className={n > soft ? 'text-amber-600' : 'text-slate-400'}>
      {n}/{soft}
    </span>
  );
}

export function AdminHomepageSeoPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-homepage'],
    queryFn: getCmsHomepageAdmin,
  });
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data) setForm(fromView(data));
  }, [data]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = toPayload(form);
      if (!body.heading) throw new ApiError(400, 'H1 là bắt buộc');
      return saveCmsHomepageAdmin(body);
    },
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-homepage'] });
      setForm(fromView(res));
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  async function onOgImage(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadCmsMedia(file);
      patch('ogImageUrl', res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  }

  const ogSrc = resolveCmsAssetUrl(form.ogImageUrl || '') || form.ogImageUrl || '';
  const titlePreview =
    form.seoTitle?.trim() ||
    form.heading?.trim() ||
    `${BRAND_NAME} — Kết nối nhân tài, dẫn lối công nghiệp`;
  const descPreview =
    form.seoDescription?.trim() ||
    form.subtitle?.trim() ||
    'Kết nối nhân tài công nghiệp B2B trên inlink.';

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title">SEO trang chủ</h1>
          <p className="cms-page-subtitle">
            H1 / tiêu đề / meta description / OG — tối ưu SERP cho{' '}
            <code className="text-xs">/</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-accent-200"
          >
            Xem trang chủ <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Button
            type="button"
            className="gap-1.5"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã lưu SEO trang chủ.
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <CmsCollapsiblePanel title="Hero (H1 & mô tả)" defaultOpen>
              <Field label="Heading H1 *">
                <Input
                  value={form.heading ?? ''}
                  onChange={(e) => patch('heading', e.target.value)}
                  required
                  maxLength={200}
                />
              </Field>
              <Field label="Đoạn tô màu accent (nằm trong H1)">
                <Input
                  value={form.headingAccent ?? ''}
                  onChange={(e) => patch('headingAccent', e.target.value)}
                  placeholder="VD: ngành công nghiệp"
                  maxLength={120}
                />
              </Field>
              <Field label="Mô tả dưới H1">
                <textarea
                  className="cms-field-control min-h-[88px]"
                  value={form.subtitle ?? ''}
                  onChange={(e) => patch('subtitle', e.target.value)}
                  maxLength={500}
                />
              </Field>
            </CmsCollapsiblePanel>

            <CmsCollapsiblePanel title="Meta SEO" defaultOpen>
              <div>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                  <span>SEO Title</span>
                  <CharCount value={form.seoTitle ?? ''} soft={60} />
                </div>
                <Input
                  value={form.seoTitle ?? ''}
                  onChange={(e) => patch('seoTitle', e.target.value)}
                  placeholder="Tiêu đề trên Google SERP"
                  maxLength={200}
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                  <span>Meta description</span>
                  <CharCount value={form.seoDescription ?? ''} soft={160} />
                </div>
                <textarea
                  className="cms-field-control min-h-[88px]"
                  value={form.seoDescription ?? ''}
                  onChange={(e) => patch('seoDescription', e.target.value)}
                  placeholder="Mô tả snippet Google (~150–160 ký tự)"
                  maxLength={500}
                />
              </div>
              <Field label="Focus keyword">
                <Input
                  value={form.focusKeyword ?? ''}
                  onChange={(e) => patch('focusKeyword', e.target.value)}
                  placeholder="VD: việc làm công nghiệp"
                  maxLength={120}
                />
              </Field>
              <Field label="Canonical">
                <Input
                  value={form.canonicalPath ?? '/'}
                  onChange={(e) => patch('canonicalPath', e.target.value)}
                  placeholder="/"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
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
                <Field label="Max image preview">
                  <Select
                    value={form.robotsMaxImagePreview ? 'large' : 'standard'}
                    onChange={(e) =>
                      patch('robotsMaxImagePreview', e.target.value === 'large')
                    }
                  >
                    <option value="large">Large</option>
                    <option value="standard">Standard</option>
                  </Select>
                </Field>
              </div>
            </CmsCollapsiblePanel>

            <CmsCollapsiblePanel title="Open Graph / Social" defaultOpen={false}>
              <Field label="OG Title">
                <Input
                  value={form.ogTitle ?? ''}
                  onChange={(e) => patch('ogTitle', e.target.value)}
                  placeholder="Để trống = SEO Title"
                />
              </Field>
              <Field label="OG Description">
                <textarea
                  className="cms-field-control min-h-[72px]"
                  value={form.ogDescription ?? ''}
                  onChange={(e) => patch('ogDescription', e.target.value)}
                  placeholder="Để trống = Meta description"
                />
              </Field>
              <Field label="OG Image">
                <div className="flex flex-wrap items-center gap-3">
                  {ogSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ogSrc}
                      alt=""
                      className="h-16 w-28 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    {uploading ? 'Đang tải…' : 'Tải ảnh OG'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        void onOgImage(f);
                      }}
                    />
                  </label>
                  {form.ogImageUrl ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600"
                      onClick={() => patch('ogImageUrl', '')}
                    >
                      Xoá
                    </button>
                  ) : null}
                </div>
              </Field>
            </CmsCollapsiblePanel>
          </div>

          <div className="space-y-4">
            <Card className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Google preview
              </p>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="truncate text-sm text-[#1a0dab]">{titlePreview}</p>
                <p className="mt-0.5 truncate text-xs text-emerald-700">inlink.vn/</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {descPreview}
                </p>
              </div>
            </Card>
            <Card className="space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Gợi ý</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>SEO Title ~50–60 ký tự, có brand ở cuối nếu cần.</li>
                <li>Meta description ~150–160 ký tự, chứa CTA rõ.</li>
                <li>H1 khớp intent trang chủ (tuyển dụng công nghiệp B2B).</li>
                <li>Accent phải là chuỗi con của H1.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
