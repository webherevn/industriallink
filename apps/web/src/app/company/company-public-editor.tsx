'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CompanyBrandProfile } from '@industriallink/contracts';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  companyMediaUrl,
  deleteCompanyBanner,
  deleteCompanyCulture,
  updateCompanyBrand,
  uploadCompanyBanner,
  uploadCompanyCulture,
} from '@/lib/company';

type BrandForm = {
  internationalName: string;
  email: string;
  phone: string;
  foundedYear: string;
  bannerCaption: string;
  facebookUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  cultureNote: string;
  coreActivities: string;
  whyChooseUs: string;
  benefits: string;
  awards: string;
  yearsActive: string;
  employees: string;
  customers: string;
  projects: string;
  locations: string;
  cultureTitle: string;
  cultureCaption: string;
};

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function join(list?: string[]): string {
  return (list ?? []).join('\n');
}

function num(value?: number | null): string {
  return value == null ? '' : String(value);
}

function fromBrand(brand?: CompanyBrandProfile | null): BrandForm {
  return {
    internationalName: brand?.internationalName ?? '',
    email: brand?.email ?? '',
    phone: brand?.phone ?? '',
    foundedYear: num(brand?.foundedYear),
    bannerCaption: brand?.bannerCaption ?? '',
    facebookUrl: brand?.facebookUrl ?? '',
    linkedinUrl: brand?.linkedinUrl ?? '',
    youtubeUrl: brand?.youtubeUrl ?? '',
    cultureNote: brand?.cultureNote ?? '',
    coreActivities: join(brand?.coreActivities),
    whyChooseUs: join(brand?.whyChooseUs),
    benefits: join(brand?.benefits),
    awards: join(brand?.awards?.map((item) => item.name)),
    yearsActive: num(brand?.stats?.yearsActive),
    employees: num(brand?.stats?.employees),
    customers: num(brand?.stats?.customers),
    projects: num(brand?.stats?.projects),
    locations: num(brand?.stats?.locations),
    cultureTitle: '',
    cultureCaption: '',
  };
}

function countOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

export function CompanyPublicEditor({
  companyId,
  brand,
  canEdit,
}: {
  companyId: string;
  brand?: CompanyBrandProfile | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BrandForm>(() => fromBrand(brand));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(fromBrand(brand));
  }, [brand]);

  function refresh(next?: CompanyBrandProfile) {
    queryClient.setQueryData(['my-company'], (current: { brand?: CompanyBrandProfile } | undefined) =>
      current ? { ...current, brand: next ?? current.brand } : current,
    );
    queryClient.invalidateQueries({ queryKey: ['my-company'] });
    queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
  }

  const save = useMutation({
    mutationFn: () =>
      updateCompanyBrand({
        internationalName: form.internationalName,
        email: form.email,
        phone: form.phone,
        foundedYear: countOrNull(form.foundedYear),
        bannerCaption: form.bannerCaption,
        facebookUrl: form.facebookUrl,
        linkedinUrl: form.linkedinUrl,
        youtubeUrl: form.youtubeUrl,
        cultureNote: form.cultureNote,
        coreActivities: lines(form.coreActivities),
        whyChooseUs: lines(form.whyChooseUs),
        benefits: lines(form.benefits),
        awards: lines(form.awards).map((name) => ({ name })),
        stats: {
          yearsActive: countOrNull(form.yearsActive),
          employees: countOrNull(form.employees),
          customers: countOrNull(form.customers),
          projects: countOrNull(form.projects),
          locations: countOrNull(form.locations),
        },
        cultureTexts: (brand?.cultureGallery ?? [])
          .filter((item) => item.id)
          .map((item) => ({
            id: item.id as string,
            title: item.title,
            caption: item.caption,
          })),
      }),
    onSuccess: (next) => {
      setSaved(true);
      refresh(next);
    },
  });

  const bannerUpload = useMutation({
    mutationFn: (file: File) => uploadCompanyBanner(file),
    onSuccess: (next) => refresh(next),
  });

  const bannerDelete = useMutation({
    mutationFn: deleteCompanyBanner,
    onSuccess: (next) => refresh(next),
  });

  const cultureUpload = useMutation({
    mutationFn: (file: File) => uploadCompanyCulture(file, form.cultureTitle, form.cultureCaption),
    onSuccess: (next) => {
      setForm((current) => ({ ...current, cultureTitle: '', cultureCaption: '' }));
      refresh(next);
    },
  });

  const cultureDelete = useMutation({
    mutationFn: (id: string) => deleteCompanyCulture(id),
    onSuccess: (next) => refresh(next),
  });

  if (!canEdit) return null;

  const bannerSrc = companyMediaUrl(brand?.bannerUrl);
  const errorText = (error: unknown) =>
    error instanceof ApiError ? error.message : 'Không lưu được. Thử lại.';

  return (
    <Card className="mt-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Trang công khai</h2>
        <p className="mt-1 text-sm text-slate-500">
          Banner, văn hóa và các mục này hiện trên trang thông tin công ty cho ứng viên.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="relative h-36 bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500">
          {bannerSrc ? (
            <img src={bannerSrc} alt="Banner công ty" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <ImagePlus className="h-4 w-4" />
            {bannerUpload.isPending ? 'Đang tải…' : 'Tải banner'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) bannerUpload.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
          {bannerSrc ? (
            <Button
              variant="outline"
              onClick={() => bannerDelete.mutate()}
              disabled={bannerDelete.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Gỡ banner
            </Button>
          ) : (
            <span className="text-xs text-slate-500">Ảnh ngang, tối đa 5MB. Nên rộng khoảng 1600px.</span>
          )}
        </div>
      </div>
      {bannerUpload.isError ? <p className="text-sm text-rose-600">{errorText(bannerUpload.error)}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dòng chữ trên banner">
          <Input
            value={form.bannerCaption}
            onChange={(event) => setForm({ ...form, bannerCaption: event.target.value })}
            placeholder="Ví dụ: Đồng hành cùng ngành công nghiệp Việt"
          />
        </Field>
        <Field label="Tên quốc tế">
          <Input
            value={form.internationalName}
            onChange={(event) => setForm({ ...form, internationalName: event.target.value })}
          />
        </Field>
        <Field label="Email liên hệ">
          <Input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="hr@congty.vn"
          />
        </Field>
        <Field label="Điện thoại">
          <Input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </Field>
        <Field label="Năm thành lập">
          <Input
            inputMode="numeric"
            value={form.foundedYear}
            onChange={(event) => setForm({ ...form, foundedYear: event.target.value })}
            placeholder="2012"
          />
        </Field>
        <Field label="Facebook">
          <Input
            value={form.facebookUrl}
            onChange={(event) => setForm({ ...form, facebookUrl: event.target.value })}
          />
        </Field>
        <Field label="LinkedIn">
          <Input
            value={form.linkedinUrl}
            onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })}
          />
        </Field>
        <Field label="YouTube">
          <Input
            value={form.youtubeUrl}
            onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })}
          />
        </Field>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">Con số trên trang</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-5">
          {(
            [
              ['yearsActive', 'Năm hoạt động'],
              ['employees', 'Nhân sự'],
              ['customers', 'Khách hàng'],
              ['projects', 'Dự án'],
              ['locations', 'Tỉnh / TP'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                inputMode="numeric"
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </Field>
          ))}
        </div>
      </div>

      <Field label="Lĩnh vực hoạt động chính" description="Mỗi dòng một lĩnh vực">
        <Textarea
          rows={3}
          value={form.coreActivities}
          onChange={(event) => setForm({ ...form, coreActivities: event.target.value })}
        />
      </Field>
      <Field label="Vì sao chọn chúng tôi" description="Mỗi dòng một ý">
        <Textarea
          rows={3}
          value={form.whyChooseUs}
          onChange={(event) => setForm({ ...form, whyChooseUs: event.target.value })}
        />
      </Field>
      <Field label="Phúc lợi" description="Mỗi dòng một phúc lợi">
        <Textarea
          rows={3}
          value={form.benefits}
          onChange={(event) => setForm({ ...form, benefits: event.target.value })}
        />
      </Field>
      <Field label="Chứng nhận và giải thưởng" description="Mỗi dòng một tên">
        <Textarea
          rows={3}
          value={form.awards}
          onChange={(event) => setForm({ ...form, awards: event.target.value })}
        />
      </Field>
      <Field label="Văn hóa doanh nghiệp">
        <Textarea
          rows={4}
          value={form.cultureNote}
          onChange={(event) => setForm({ ...form, cultureNote: event.target.value })}
          placeholder="Cách công ty làm việc, giá trị và môi trường đội ngũ."
        />
      </Field>

      <div>
        <p className="text-sm font-semibold text-slate-800">Ảnh văn hóa</p>
        <p className="mt-1 text-xs text-slate-500">Tối đa 8 ảnh. Tiêu đề hiện dưới ảnh trên trang công khai.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(brand?.cultureGallery ?? []).map((item) => {
            const src = companyMediaUrl(item.url);
            return (
              <figure key={item.id ?? item.url} className="overflow-hidden rounded-xl border border-slate-200">
                {src ? <img src={src} alt={item.title} className="aspect-[4/3] w-full object-cover" /> : null}
                <figcaption className="flex items-start justify-between gap-2 p-2">
                  <span className="text-xs font-semibold text-slate-700">{item.title}</span>
                  {item.id ? (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Xóa ảnh"
                      onClick={() => cultureDelete.mutate(item.id as string)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Tiêu đề ảnh">
            <Input
              value={form.cultureTitle}
              onChange={(event) => setForm({ ...form, cultureTitle: event.target.value })}
            />
          </Field>
          <Field label="Chú thích">
            <Input
              value={form.cultureCaption}
              onChange={(event) => setForm({ ...form, cultureCaption: event.target.value })}
            />
          </Field>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {cultureUpload.isPending ? 'Đang tải…' : 'Thêm ảnh'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={!form.cultureTitle.trim() || cultureUpload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) cultureUpload.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {cultureUpload.isError ? (
          <p className="mt-2 text-sm text-rose-600">{errorText(cultureUpload.error)}</p>
        ) : null}
      </div>

      {save.isError ? <p className="text-sm text-rose-600">{errorText(save.error)}</p> : null}
      {saved && !save.isPending ? <p className="text-sm text-emerald-700">Đã lưu nội dung trang công khai.</p> : null}
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Đang lưu…' : 'Lưu nội dung trang'}
      </Button>
    </Card>
  );
}
