'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { CompanyBrandProfile } from '@industriallink/contracts';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { updateCompanyBrand } from '@/lib/company';

type PublicBrandForm = {
  internationalName: string;
  bannerCaption: string;
  coreActivities: string;
  whyChooseUs: string;
  benefits: string;
  awards: string;
  yearsActive: string;
  employees: string;
  customers: string;
  projects: string;
  locations: string;
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

function fromBrand(brand?: CompanyBrandProfile | null): PublicBrandForm {
  return {
    internationalName: brand?.internationalName ?? '',
    bannerCaption: brand?.bannerCaption ?? '',
    coreActivities: join(brand?.coreActivities),
    whyChooseUs: join(brand?.whyChooseUs),
    benefits: join(brand?.benefits),
    awards: join(brand?.awards?.map((item) => item.name)),
    yearsActive: num(brand?.stats?.yearsActive),
    employees: num(brand?.stats?.employees),
    customers: num(brand?.stats?.customers),
    projects: num(brand?.stats?.projects),
    locations: num(brand?.stats?.locations),
  };
}

function countOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm animate-soft-rise">
      <div className="border-b border-brand-50 bg-gradient-to-r from-brand-50 via-white to-accent-50/60 px-5 py-3">
        <h3 className="text-sm font-bold text-brand-700">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
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
  const [form, setForm] = useState<PublicBrandForm>(() => fromBrand(brand));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(fromBrand(brand));
  }, [brand]);

  function refresh(next?: CompanyBrandProfile) {
    queryClient.setQueryData(
      ['my-company'],
      (current: { brand?: CompanyBrandProfile } | undefined) =>
        current ? { ...current, brand: next ?? current.brand } : current,
    );
    queryClient.invalidateQueries({ queryKey: ['my-company'] });
    queryClient.invalidateQueries({ queryKey: ['company-profile', companyId] });
  }

  // Chỉ gửi đúng các trường thương hiệu công khai — không ghi đè Liên hệ / Văn hóa / Ảnh ở các tab khác.
  const save = useMutation({
    mutationFn: () =>
      updateCompanyBrand({
        internationalName: form.internationalName,
        bannerCaption: form.bannerCaption,
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
      }),
    onSuccess: (next) => {
      setSaved(true);
      refresh(next);
    },
  });

  if (!canEdit) return null;

  const errorText = (error: unknown) =>
    error instanceof ApiError ? error.message : 'Không lưu được. Thử lại.';

  return (
    <div className="ntd-form space-y-4">
      <Panel
        title="Nhận diện trang công khai"
        hint="Tên quốc tế và dòng khẩu hiệu hiển thị nổi bật trên trang hồ sơ doanh nghiệp công khai."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên quốc tế (tuỳ chọn)">
            <Input
              value={form.internationalName}
              onChange={(event) => {
                setSaved(false);
                setForm({ ...form, internationalName: event.target.value });
              }}
              placeholder="Ví dụ: Thien Binh International JSC"
            />
          </Field>
          <Field label="Dòng chữ trên banner (Tagline)">
            <Input
              value={form.bannerCaption}
              onChange={(event) => {
                setSaved(false);
                setForm({ ...form, bannerCaption: event.target.value });
              }}
              placeholder="Ví dụ: Đồng hành cùng ngành công nghiệp Việt"
            />
          </Field>
        </div>
      </Panel>

      <Panel
        title="Con số nổi bật"
        hint="Các chỉ số ấn tượng hiển thị trên trang công khai (ô trống sẽ tự ẩn)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ['yearsActive', 'Năm hoạt động'],
              ['employees', 'Nhân sự'],
              ['customers', 'Khách hàng'],
              ['projects', 'Dự án'],
              ['locations', 'Tỉnh / TP'],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 transition duration-200 hover:border-brand-300 hover:bg-white"
            >
              <Field label={label}>
                <Input
                  inputMode="numeric"
                  value={form[key]}
                  onChange={(event) => {
                    setSaved(false);
                    setForm({ ...form, [key]: event.target.value });
                  }}
                />
              </Field>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Điểm thu hút ứng viên"
        hint="Mỗi dòng một ý. Mục để trống sẽ không hiển thị trên trang công khai."
      >
        <Field label="Lĩnh vực hoạt động chính" description="Mỗi dòng một lĩnh vực">
          <Textarea
            rows={3}
            value={form.coreActivities}
            onChange={(event) => {
              setSaved(false);
              setForm({ ...form, coreActivities: event.target.value });
            }}
          />
        </Field>
        <Field label="Vì sao chọn chúng tôi" description="Mỗi dòng một lý do">
          <Textarea
            rows={3}
            value={form.whyChooseUs}
            onChange={(event) => {
              setSaved(false);
              setForm({ ...form, whyChooseUs: event.target.value });
            }}
          />
        </Field>
        <Field label="Phúc lợi nổi bật" description="Mỗi dòng một phúc lợi">
          <Textarea
            rows={3}
            value={form.benefits}
            onChange={(event) => {
              setSaved(false);
              setForm({ ...form, benefits: event.target.value });
            }}
          />
        </Field>
        <Field label="Chứng nhận và giải thưởng" description="Mỗi dòng một chứng nhận / giải thưởng">
          <Textarea
            rows={3}
            value={form.awards}
            onChange={(event) => {
              setSaved(false);
              setForm({ ...form, awards: event.target.value });
            }}
          />
        </Field>
      </Panel>

      {save.isError ? <p className="text-sm text-rose-600">{errorText(save.error)}</p> : null}
      {saved && !save.isPending ? (
        <p className="text-sm text-emerald-700">Đã lưu nội dung trang công khai.</p>
      ) : null}
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Đang lưu…' : 'Lưu nội dung trang'}
      </Button>
    </div>
  );
}
