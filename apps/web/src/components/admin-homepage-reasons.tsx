'use client';

import {
  DEFAULT_HOMEPAGE_REASONS,
  HOMEPAGE_REASON_ICONS,
  normalizeHomepageReasons,
  type HomepageReasonIcon,
  type HomepageReasonItem,
  type HomepageReasonsContent,
} from '@industriallink/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CmsMediaPicker } from '@/components/cms-media-library';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { saveHomepageReasonsAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

const ICON_LABEL: Record<HomepageReasonIcon, string> = {
  people: 'Hai người',
  chart: 'Biểu đồ',
  blocked: 'Dấu không',
  chat: 'Chat',
  factory: 'Nhà máy',
};

function cloneReasons(value: HomepageReasonsContent): HomepageReasonsContent {
  return normalizeHomepageReasons(value);
}

export function AdminHomepageReasonsForm({
  initial,
}: {
  initial: HomepageReasonsContent | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<HomepageReasonsContent>(cloneReasons(initial ?? DEFAULT_HOMEPAGE_REASONS));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    if (initial) setForm(cloneReasons(initial));
  }, [initial]);

  const save = useMutation({
    mutationFn: () => saveHomepageReasonsAdmin(normalizeHomepageReasons(form)),
    onSuccess: async (view) => {
      setForm(cloneReasons(view.reasons));
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-homepage'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không lưu được khối lý do'),
  });

  function patchItem(index: number, partial: Partial<HomepageReasonItem>) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...partial } : item)),
    }));
  }

  async function upload(index: number, file: File) {
    setUploading(index);
    setError(null);
    try {
      const res = await uploadCmsMedia(file);
      patchItem(index, { imageUrl: res.url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploading(null);
    }
  }

  return (
    <form
      className="mt-4 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        save.mutate();
      }}
    >
      <section className="admin-dash-card space-y-4 p-5">
        <h2 className="text-sm font-bold text-[#072348]">Vì sao chọn inlink</h2>
        <p className="text-xs text-slate-500">Khối này hiện ngay dưới danh sách việc làm. Để trống ảnh thì dùng icon có sẵn.</p>
        <Field label="Tiêu đề" description="Cụm gạch chân cam phải nằm đúng trong tiêu đề.">
          <Input
            value={form.title}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, title: event.target.value }));
            }}
          />
        </Field>
        <Field label="Cụm gạch chân">
          <Input
            value={form.titleAccent}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, titleAccent: event.target.value }));
            }}
          />
        </Field>
        <Field label="Dòng mô tả">
          <Input
            value={form.subtitle}
            onChange={(event) => {
              setSaved(false);
              setForm((current) => ({ ...current, subtitle: event.target.value }));
            }}
          />
        </Field>
      </section>

      {form.items.map((item, index) => {
        const src = resolveCmsAssetUrl(item.imageUrl);
        return (
          <section key={index} className="admin-dash-card space-y-3 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ý {index + 1}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tiêu đề">
                <Input value={item.title} onChange={(event) => patchItem(index, { title: event.target.value })} />
              </Field>
              <Field label="Icon có sẵn">
                <select
                  className="cms-field-control"
                  value={item.icon}
                  onChange={(event) => patchItem(index, { icon: event.target.value as HomepageReasonIcon })}
                >
                  {HOMEPAGE_REASON_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {ICON_LABEL[icon]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Mô tả">
              <textarea
                className="cms-field-control min-h-[72px]"
                value={item.description}
                onChange={(event) => patchItem(index, { description: event.target.value })}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              {src ? (
                <img src={src} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072348]">
                {uploading === index ? 'Đang tải…' : 'Tải ảnh thay icon'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploading === index}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void upload(index, file);
                  }}
                />
              </label>
              <button type="button" className="text-xs font-semibold text-[#072348]" onClick={() => setSlot(index)}>
                Thư viện
              </button>
              {item.imageUrl ? (
                <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => patchItem(index, { imageUrl: '' })}>
                  Dùng icon
                </button>
              ) : null}
            </div>
          </section>
        );
      })}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Đã lưu khối lý do.</p> : null}
      <Button type="submit" disabled={save.isPending}>
        <Save className="h-4 w-4" />
        {save.isPending ? 'Đang lưu…' : 'Lưu khối lý do'}
      </Button>

      <CmsMediaPicker
        open={slot != null}
        onClose={() => setSlot(null)}
        onSelect={(url) => {
          if (slot != null) patchItem(slot, { imageUrl: url });
          setSlot(null);
        }}
      />
    </form>
  );
}
