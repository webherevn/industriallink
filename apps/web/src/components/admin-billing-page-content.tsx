'use client';

import {
  DEFAULT_BILLING_PAGE_CONTENT,
  type AdminUpdatePageContentRequest,
  type BillingPageContentView,
  type BillingPageFaqItem,
  type BillingPageTextItem,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Heading,
  HelpCircle,
  ImageIcon,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Field, Input, Select } from '@/components/ui';
import { fetchAdminPageContent, updateAdminPageContent } from '@/lib/admin-billing';
import { uploadCmsMedia } from '@/lib/admin-cms';
import { ApiError } from '@/lib/api';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

type FormState = BillingPageContentView;

function fromView(v: BillingPageContentView): FormState {
  return {
    ...v,
    features: v.features.map((x) => ({ ...x })),
    howSteps: v.howSteps.map((x) => ({ ...x })),
    faqItems: v.faqItems.map((x) => ({ ...x })),
    trustItems: v.trustItems.map((x) => ({ ...x })),
  };
}

function toPayload(form: FormState): AdminUpdatePageContentRequest {
  const t = (v?: string | null) => (v?.trim() ? v.trim() : null);
  return {
    seoTitle: form.seoTitle.trim(),
    seoDescription: form.seoDescription.trim(),
    seoTitleRecruiter: form.seoTitleRecruiter.trim(),
    seoDescriptionRecruiter: form.seoDescriptionRecruiter.trim(),
    focusKeyword: t(form.focusKeyword),
    ogTitle: t(form.ogTitle),
    ogDescription: t(form.ogDescription),
    ogImageUrl: t(form.ogImageUrl),
    ogImageAlt: form.ogImageAlt.trim(),
    robotsIndex: form.robotsIndex,
    robotsFollow: form.robotsFollow,
    heroBadge: form.heroBadge.trim(),
    heroHeading: form.heroHeading.trim(),
    heroHeadingAccent: form.heroHeadingAccent.trim(),
    heroSubtitle: form.heroSubtitle.trim(),
    heroSocialProof: form.heroSocialProof.trim(),
    heroCtaPrimary: form.heroCtaPrimary.trim(),
    heroCtaSecondary: form.heroCtaSecondary.trim(),
    recruiterKicker: form.recruiterKicker.trim(),
    recruiterHeading: form.recruiterHeading.trim(),
    recruiterSubtitle: form.recruiterSubtitle.trim(),
    platformTitle: form.platformTitle.trim(),
    platformSubtitle: form.platformSubtitle.trim(),
    sourcingTitle: form.sourcingTitle.trim(),
    sourcingSubtitle: form.sourcingSubtitle.trim(),
    creditTitle: form.creditTitle.trim(),
    creditSubtitle: form.creditSubtitle.trim(),
    featuresTitle: form.featuresTitle.trim(),
    featuresSubtitle: form.featuresSubtitle.trim(),
    compareTitle: form.compareTitle.trim(),
    compareSubtitle: form.compareSubtitle.trim(),
    howTitle: form.howTitle.trim(),
    howSubtitle: form.howSubtitle.trim(),
    howFooter: form.howFooter.trim(),
    faqTitle: form.faqTitle.trim(),
    faqSubtitle: form.faqSubtitle.trim(),
    contactTitle: form.contactTitle.trim(),
    contactSubtitle: form.contactSubtitle.trim(),
    finalCtaTitle: form.finalCtaTitle.trim(),
    finalCtaSubtitle: form.finalCtaSubtitle.trim(),
    footerTagline: form.footerTagline.trim(),
    consultNavText: form.consultNavText.trim(),
    contactEmail: form.contactEmail.trim(),
    contactEmailDesc: form.contactEmailDesc.trim(),
    contactHotline: form.contactHotline.trim(),
    contactHotlineHref: form.contactHotlineHref.trim(),
    contactHotlineDesc: form.contactHotlineDesc.trim(),
    contactZaloLabel: form.contactZaloLabel.trim(),
    contactZaloHref: form.contactZaloHref.trim(),
    contactZaloDesc: form.contactZaloDesc.trim(),
    features: form.features.filter((x) => x.title.trim()),
    howSteps: form.howSteps.filter((x) => x.title.trim()),
    faqItems: form.faqItems.filter((x) => x.q.trim() && x.a.trim()),
    trustItems: form.trustItems.filter((x) => x.title.trim()),
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

function Panel({
  title,
  hint,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint: string;
  icon: typeof Heading;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="admin-dash-card overflow-hidden">
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

function TextItemEditor({
  items,
  onChange,
  titleLabel = 'Tiêu đề',
  descLabel = 'Mô tả',
  addLabel,
}: {
  items: BillingPageTextItem[];
  onChange: (next: BillingPageTextItem[]) => void;
  titleLabel?: string;
  descLabel?: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">#{i + 1}</span>
            <button
              type="button"
              className="text-rose-600 hover:text-rose-700"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Field label={titleLabel}>
            <Input
              value={item.title}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
            />
          </Field>
          <Field label={descLabel}>
            <textarea
              className="cms-field-control min-h-[72px]"
              value={item.desc}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))
              }
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { title: '', desc: '' }])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#072348]"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: BillingPageFaqItem[];
  onChange: (next: BillingPageFaqItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Câu {i + 1}
            </span>
            <button
              type="button"
              className="text-rose-600 hover:text-rose-700"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label="Xoá"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <Field label="Câu hỏi">
            <Input
              value={item.q}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
            />
          </Field>
          <Field label="Câu trả lời">
            <textarea
              className="cms-field-control min-h-[88px]"
              value={item.a}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { q: '', a: '' }])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#072348]"
      >
        <Plus className="h-3.5 w-3.5" /> Thêm câu hỏi
      </button>
    </div>
  );
}

export function AdminBillingPageContent() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-billing-page-content'],
    queryFn: fetchAdminPageContent,
  });
  const [form, setForm] = useState<FormState>(DEFAULT_BILLING_PAGE_CONTENT);
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
    mutationFn: () => updateAdminPageContent(toPayload(form)),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-billing-page-content'] });
      await qc.invalidateQueries({ queryKey: ['billing-public-config'] });
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
  const titlePreview = form.seoTitle?.trim() || 'Bảng giá dịch vụ — inlink';
  const descPreview = form.seoDescription?.trim() || '';

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">
            Bảng giá
          </p>
          <h1 className="cms-page-title mt-1.5">Nội dung trang /bang-gia</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            Chỉnh tiêu đề, SEO, FAQ, hotline, Zalo, email. Giá và hạn mức gói vẫn nằm ở mục Gói nền
            tảng / Săn / Top-up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bang-gia"
            target="_blank"
            className="admin-dash-card inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-[#072348]"
          >
            Xem trang <ExternalLink className="h-4 w-4 text-[#E8872A]" />
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
          Đã lưu nội dung trang bảng giá.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="admin-dash-skel h-44" />
          <div className="admin-dash-skel h-72" />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <Panel title="SEO & meta" hint="Title, description, robots cho Google" icon={Search} defaultOpen>
              <div>
                <CharMeter value={form.seoTitle} soft={60} label="SEO Title (public)" />
                <Input value={form.seoTitle} onChange={(e) => patch('seoTitle', e.target.value)} maxLength={200} />
              </div>
              <div>
                <CharMeter value={form.seoDescription} soft={160} label="Meta description (public)" />
                <textarea
                  className="cms-field-control min-h-[80px]"
                  value={form.seoDescription}
                  onChange={(e) => patch('seoDescription', e.target.value)}
                  maxLength={500}
                />
              </div>
              <div>
                <CharMeter value={form.seoTitleRecruiter} soft={60} label="SEO Title (NTD / recruiter)" />
                <Input
                  value={form.seoTitleRecruiter}
                  onChange={(e) => patch('seoTitleRecruiter', e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <CharMeter value={form.seoDescriptionRecruiter} soft={160} label="Meta description (NTD)" />
                <textarea
                  className="cms-field-control min-h-[80px]"
                  value={form.seoDescriptionRecruiter}
                  onChange={(e) => patch('seoDescriptionRecruiter', e.target.value)}
                  maxLength={500}
                />
              </div>
              <Field label="Focus keyword">
                <Input
                  value={form.focusKeyword ?? ''}
                  onChange={(e) => patch('focusKeyword', e.target.value)}
                  placeholder="VD: bảng giá tuyển dụng"
                  maxLength={120}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Index (trên host NTD)">
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
            </Panel>

            <Panel title="Ảnh đại diện / Open Graph" hint="Ảnh và chữ khi chia sẻ mạng xã hội" icon={Share2}>
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
              <Field label="Alt ảnh">
                <Input value={form.ogImageAlt} onChange={(e) => patch('ogImageAlt', e.target.value)} />
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
            </Panel>

            <Panel title="Hero (public)" hint="Tiêu đề lớn trên trang khách" icon={Heading}>
              <Field label="Badge">
                <Input value={form.heroBadge} onChange={(e) => patch('heroBadge', e.target.value)} />
              </Field>
              <Field label="Heading">
                <Input value={form.heroHeading} onChange={(e) => patch('heroHeading', e.target.value)} />
              </Field>
              <Field label="Đoạn accent (màu vàng)">
                <Input
                  value={form.heroHeadingAccent}
                  onChange={(e) => patch('heroHeadingAccent', e.target.value)}
                />
              </Field>
              <Field label="Mô tả">
                <textarea
                  className="cms-field-control min-h-[80px]"
                  value={form.heroSubtitle}
                  onChange={(e) => patch('heroSubtitle', e.target.value)}
                />
              </Field>
              <Field label="Social proof">
                <Input value={form.heroSocialProof} onChange={(e) => patch('heroSocialProof', e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CTA chính">
                  <Input value={form.heroCtaPrimary} onChange={(e) => patch('heroCtaPrimary', e.target.value)} />
                </Field>
                <Field label="CTA phụ">
                  <Input
                    value={form.heroCtaSecondary}
                    onChange={(e) => patch('heroCtaSecondary', e.target.value)}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Hero (NTD đã đăng nhập)" hint="Kicker / heading trên host recruiter" icon={Heading}>
              <Field label="Kicker">
                <Input value={form.recruiterKicker} onChange={(e) => patch('recruiterKicker', e.target.value)} />
              </Field>
              <Field label="Heading">
                <Input value={form.recruiterHeading} onChange={(e) => patch('recruiterHeading', e.target.value)} />
              </Field>
              <Field label="Mô tả">
                <Input
                  value={form.recruiterSubtitle}
                  onChange={(e) => patch('recruiterSubtitle', e.target.value)}
                />
              </Field>
            </Panel>

            <Panel title="Tiêu đề các section" hint="Chữ quanh các khối gói — không gồm số liệu" icon={FileText}>
              {(
                [
                  ['platformTitle', 'platformSubtitle', 'Gói nền tảng'],
                  ['sourcingTitle', 'sourcingSubtitle', 'Săn nhân sự'],
                  ['creditTitle', 'creditSubtitle', 'Top-up Credit'],
                  ['featuresTitle', 'featuresSubtitle', 'Tính năng'],
                  ['compareTitle', 'compareSubtitle', 'So sánh'],
                  ['howTitle', 'howSubtitle', 'Cách tính phí'],
                  ['faqTitle', 'faqSubtitle', 'FAQ'],
                  ['contactTitle', 'contactSubtitle', 'Liên hệ'],
                  ['finalCtaTitle', 'finalCtaSubtitle', 'CTA cuối'],
                ] as const
              ).map(([titleKey, subKey, label]) => (
                <div key={titleKey} className="grid gap-3 sm:grid-cols-2">
                  <Field label={`${label} — tiêu đề`}>
                    <Input value={form[titleKey]} onChange={(e) => patch(titleKey, e.target.value)} />
                  </Field>
                  <Field label={`${label} — mô tả`}>
                    <Input value={form[subKey]} onChange={(e) => patch(subKey, e.target.value)} />
                  </Field>
                </div>
              ))}
              <Field label="Dòng dưới block Cách tính phí">
                <Input value={form.howFooter} onChange={(e) => patch('howFooter', e.target.value)} />
              </Field>
              <Field label="Tagline footer">
                <Input value={form.footerTagline} onChange={(e) => patch('footerTagline', e.target.value)} />
              </Field>
              <Field label="Link tư vấn trên thanh tab">
                <Input value={form.consultNavText} onChange={(e) => patch('consultNavText', e.target.value)} />
              </Field>
            </Panel>

            <Panel title="Liên hệ" hint="Hotline, Zalo, email hiện trên trang" icon={Phone}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => patch('contactEmail', e.target.value)}
                  />
                </Field>
                <Field label="Mô tả email">
                  <Input value={form.contactEmailDesc} onChange={(e) => patch('contactEmailDesc', e.target.value)} />
                </Field>
                <Field label="Hotline">
                  <Input value={form.contactHotline} onChange={(e) => patch('contactHotline', e.target.value)} />
                </Field>
                <Field label="Hotline href">
                  <Input
                    value={form.contactHotlineHref}
                    onChange={(e) => patch('contactHotlineHref', e.target.value)}
                    placeholder="tel:19006868"
                  />
                </Field>
                <Field label="Mô tả hotline">
                  <Input
                    value={form.contactHotlineDesc}
                    onChange={(e) => patch('contactHotlineDesc', e.target.value)}
                  />
                </Field>
                <Field label="Nhãn Zalo">
                  <Input value={form.contactZaloLabel} onChange={(e) => patch('contactZaloLabel', e.target.value)} />
                </Field>
                <Field label="Link Zalo">
                  <Input
                    value={form.contactZaloHref}
                    onChange={(e) => patch('contactZaloHref', e.target.value)}
                    placeholder="https://zalo.me/..."
                  />
                </Field>
                <Field label="Mô tả Zalo">
                  <Input value={form.contactZaloDesc} onChange={(e) => patch('contactZaloDesc', e.target.value)} />
                </Field>
              </div>
            </Panel>

            <Panel title="Tính năng nổi bật" hint="Các thẻ tính năng (không gồm giá gói)" icon={FileText}>
              <TextItemEditor
                items={form.features}
                onChange={(next) => patch('features', next)}
                addLabel="Thêm tính năng"
              />
            </Panel>

            <Panel title="Các bước / cách tính phí" hint="3 bước dưới hero" icon={FileText}>
              <TextItemEditor
                items={form.howSteps}
                onChange={(next) => patch('howSteps', next)}
                addLabel="Thêm bước"
              />
            </Panel>

            <Panel title="Câu hỏi thường gặp" hint="FAQ + JSON-LD FAQPage" icon={HelpCircle} defaultOpen>
              <FaqEditor items={form.faqItems} onChange={(next) => patch('faqItems', next)} />
            </Panel>

            <Panel title="Trust items" hint="3 thẻ cam kết dưới bảng giá" icon={Check}>
              <TextItemEditor
                items={form.trustItems}
                onChange={(next) => patch('trustItems', next)}
                addLabel="Thêm mục"
              />
            </Panel>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <aside className="admin-dash-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">
                Google preview
              </p>
              <div className="mt-3 rounded-2xl border border-slate-100 bg-[#f8fafc] p-4">
                <p className="line-clamp-2 text-[15px] font-medium leading-snug text-[#1a0dab]">
                  {titlePreview}
                </p>
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{descPreview}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(form.robotsIndex ? 'index' : 'noindex') === 'index' ? (
                  <span className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]">
                    index
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    noindex
                  </span>
                )}
                <span className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]">
                  {form.robotsFollow ? 'follow' : 'nofollow'}
                </span>
              </div>
            </aside>
            <aside className="admin-dash-card p-5">
              <p className="text-sm font-semibold text-[#072348]">Liên hệ đang dùng</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {form.contactEmail || '—'}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {form.contactHotline || '—'}
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 text-slate-400" /> {form.contactZaloLabel || '—'}
                </li>
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                {form.faqItems.length} FAQ · {form.features.length} tính năng · {form.howSteps.length} bước
              </p>
            </aside>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
