'use client';

import {
  DEFAULT_HOMEPAGE_STATS,
  HOMEPAGE_STAT_ICONS,
  normalizeHomepageStats,
  type HomepageStatIcon,
  type HomepageStatItem,
  type HomepageStatsContent,
} from '@industriallink/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CmsMediaPicker } from '@/components/cms-media-library';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { saveHomepageStatsAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

const ICON_LABEL: Record<HomepageStatIcon, string> = {
  people: 'Nhóm người',
  building: 'Tòa nhà',
  badge: 'Người có huy hiệu',
  check: 'Dấu kiểm',
};

export function AdminHomepageStatsForm({ initial }: { initial: HomepageStatsContent | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<HomepageStatsContent>(normalizeHomepageStats(initial ?? DEFAULT_HOMEPAGE_STATS));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    if (initial) setForm(normalizeHomepageStats(initial));
  }, [initial]);

  const save = useMutation({
    mutationFn: () => saveHomepageStatsAdmin(normalizeHomepageStats(form)),
    onSuccess: async (view) => {
      setForm(normalizeHomepageStats(view.stats));
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-homepage'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không lưu được số liệu'),
  });

  function patchItem(index: number, partial: Partial<HomepageStatItem>) {
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
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        save.mutate();
      }}
    >
      {form.items.map((item, index) => {
        const src = resolveCmsAssetUrl(item.imageUrl);
        return (
          <div key={index} className="space-y-3 rounded-xl border border-emerald-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ô {index + 1}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Dòng đậm" description="Số hoặc câu ngắn, ví dụ 50.000+.">
                <Input value={item.value} onChange={(event) => patchItem(index, { value: event.target.value })} />
              </Field>
              <Field label="Dòng mô tả">
                <Input value={item.label} onChange={(event) => patchItem(index, { label: event.target.value })} />
              </Field>
            </div>
            <Field label="Icon có sẵn">
              <select
                className="cms-field-control"
                value={item.icon}
                onChange={(event) => patchItem(index, { icon: event.target.value as HomepageStatIcon })}
              >
                {HOMEPAGE_STAT_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {ICON_LABEL[icon]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              {src ? (
                <img src={src} alt="" className="h-12 w-12 object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
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
          </div>
        );
      })}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Đã lưu số liệu.</p> : null}
      <Button type="submit" disabled={save.isPending}>
        <Save className="h-4 w-4" />
        {save.isPending ? 'Đang lưu…' : 'Lưu số liệu'}
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
