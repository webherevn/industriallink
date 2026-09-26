'use client';

import type {
  CmsHomepageSettingsView,
  UpsertCmsHomepageSettingsRequest,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Check,
  ChevronDown,
  ExternalLink,
  Heading,
  ImageIcon,
  Save,
  Search,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Field, Input, Select } from '@/components/ui';
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

function CharMeter({ value, soft, label }: { value: string; soft: number; label: string }) {
  const n = value.length;
  const pct = Math.min(100, Math.round((n / soft) * 100));
  const over = n > soft;
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span className={over ? 'font-semibold text-amber-600' : 'text-slate-400'}>
          {n}/{soft}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={clsx('admin-dash-bar h-full rounded-full', over ? 'bg-amber-400' : 'bg-[#E8872A]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SeoPanel({
  title,
  hint,
  icon: Icon,
  defaultOpen = true,
  delay = '0ms',
  children,
}: {
  title: string;
  hint: string;
  icon: typeof Heading;
  defaultOpen?: boolean;
  delay?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="admin-dash-card admin-dash-rise overflow-hidden"
      style={{ animationDelay: delay }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#072348]">{title}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
        </span>
        <ChevronDown
          className={clsx('h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="space-y-4 border-t border-slate-100 px-5 py-5">{children}</div> : null}
    </section>
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

  const robotsPills = [
    form.robotsIndex ? 'index' : 'noindex',
    form.robotsFollow ? 'follow' : 'nofollow',
    form.robotsMaxImagePreview ? 'max-image-preview:large' : 'max-image-preview:standard',
  ];
  const accent = (form.headingAccent ?? '').trim();
  const accentOk = !accent || (form.heading ?? '').includes(accent);

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Trang chủ</p>
          <h1 className="cms-page-title mt-1.5">SEO trang chủ</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            H1, tiêu đề SERP, meta description và ảnh chia sẻ cho <span className="font-medium text-[#072348]">/</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            target="_blank"
            className="admin-dash-card inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-[#072348]"
          >
            Xem trang chủ <ExternalLink className="h-3.5 w-3.5 text-[#E8872A]" />
          </Link>
          <button
            type="button"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Đã lưu SEO trang chủ.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="admin-dash-skel h-44" />
            <div className="admin-dash-skel h-72" />
          </div>
          <div className="admin-dash-skel h-52" />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <SeoPanel title="Hero" hint="H1 và đoạn mô tả ngay dưới tiêu đề" icon={Heading}>
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
              {!accentOk ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Accent phải là chuỗi con của H1.
                </p>
              ) : null}
              <Field label="Mô tả dưới H1">
                <textarea
                  className="cms-field-control min-h-[88px]"
                  value={form.subtitle ?? ''}
                  onChange={(e) => patch('subtitle', e.target.value)}
                  maxLength={500}
                />
              </Field>
            </SeoPanel>

            <SeoPanel title="Meta SEO" hint="Tiêu đề và mô tả trên kết quả Google" icon={Search} delay="80ms">
              <div>
                <CharMeter value={form.seoTitle ?? ''} soft={60} label="SEO Title" />
                <Input
                  value={form.seoTitle ?? ''}
                  onChange={(e) => patch('seoTitle', e.target.value)}
                  placeholder="Tiêu đề trên Google SERP"
                  maxLength={200}
                />
              </div>
              <div>
                <CharMeter value={form.seoDescription ?? ''} soft={160} label="Meta description" />
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
            </SeoPanel>

            <SeoPanel
              title="Open Graph"
              hint="Ảnh và chữ khi chia sẻ lên mạng xã hội"
              icon={Share2}
              defaultOpen={false}
              delay="140ms"
            >
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
                      className="h-20 w-36 rounded-2xl object-cover shadow-[0_12px_28px_-16px_rgba(7,35,72,0.55)] ring-1 ring-slate-200"
                    />
                  ) : (
                    <div className="flex h-20 w-36 items-center justify-center rounded-2xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#072348] shadow-sm transition hover:border-[#FFD0A3] hover:bg-[#FFF8F1]">
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
            </SeoPanel>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <aside className="admin-dash-card admin-dash-rise p-5" style={{ animationDelay: '80ms' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">
                Google preview
              </p>
              <div className="mt-3 rounded-2xl border border-slate-100 bg-[#f8fafc] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#072348] text-[10px] font-bold text-white">
                    i
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-slate-700">inlink</span>
                    <span className="block truncate text-[11px] text-emerald-700">inlink.vn/</span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[15px] font-medium leading-snug text-[#1a0dab]">
                  {titlePreview}
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{descPreview}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {robotsPills.map((pill) => (
                  <span
                    key={pill}
                    className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]"
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </aside>
            <aside className="admin-dash-card admin-dash-rise p-5" style={{ animationDelay: '140ms' }}>
              <p className="text-sm font-semibold text-[#072348]">Gợi ý</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  'SEO Title khoảng 50–60 ký tự, brand ở cuối nếu cần.',
                  'Meta description khoảng 150–160 ký tự, có CTA rõ.',
                  'H1 khớp intent trang chủ: tuyển dụng công nghiệp B2B.',
                  'Accent phải là chuỗi con của H1.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
