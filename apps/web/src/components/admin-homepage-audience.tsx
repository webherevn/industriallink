'use client';

import {
  DEFAULT_HOMEPAGE_AUDIENCE,
  normalizeHomepageAudience,
  type HomepageAudienceContent,
  type HomepageAudienceJob,
} from '@industriallink/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CmsMediaPicker } from '@/components/cms-media-library';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { saveHomepageAudienceAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

type Slot = 'photo' | `job:${number}`;

export function AdminHomepageAudienceForm({ initial }: { initial: HomepageAudienceContent | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<HomepageAudienceContent>(normalizeHomepageAudience(initial ?? DEFAULT_HOMEPAGE_AUDIENCE));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [uploading, setUploading] = useState<Slot | null>(null);

  useEffect(() => {
    if (initial) setForm(normalizeHomepageAudience(initial));
  }, [initial]);

  const save = useMutation({
    mutationFn: () => saveHomepageAudienceAdmin(normalizeHomepageAudience(form)),
    onSuccess: async (view) => {
      setForm(normalizeHomepageAudience(view.audience));
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-homepage'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không lưu được khối ứng viên'),
  });

  function patch(partial: Partial<HomepageAudienceContent>) {
    setSaved(false);
    setForm((current) => ({ ...current, ...partial }));
  }

  function patchPoint(index: number, value: string) {
    const points = [...form.points] as [string, string, string, string];
    points[index] = value;
    patch({ points });
  }

  function patchJob(index: number, partial: Partial<HomepageAudienceJob>) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      jobs: current.jobs.map((job, i) => (i === index ? { ...job, ...partial } : job)),
    }));
  }

  function applyUrl(target: Slot, url: string) {
    if (target === 'photo') {
      patch({ imageUrl: url });
      return;
    }
    patchJob(Number(target.split(':')[1]), { avatarUrl: url });
  }

  async function upload(target: Slot, file: File) {
    setUploading(target);
    setError(null);
    try {
      const res = await uploadCmsMedia(file);
      applyUrl(target, res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploading(null);
    }
  }

  const photo = resolveCmsAssetUrl(form.imageUrl);

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        save.mutate();
      }}
    >
      <Field label="Dòng tiêu đề 1">
        <Input value={form.kicker} onChange={(event) => patch({ kicker: event.target.value })} />
      </Field>
      <Field label="Dòng tiêu đề 2">
        <Input value={form.title} onChange={(event) => patch({ title: event.target.value })} />
      </Field>
      <Field label="Đoạn mô tả">
        <textarea
          className="cms-field-control min-h-[88px]"
          value={form.subtitle}
          onChange={(event) => patch({ subtitle: event.target.value })}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nút bấm">
          <Input value={form.ctaLabel} onChange={(event) => patch({ ctaLabel: event.target.value })} />
        </Field>
        <Field label="Đường dẫn nút" description="Đường nội bộ bắt đầu bằng /, ví dụ /register.">
          <Input value={form.ctaHref} onChange={(event) => patch({ ctaHref: event.target.value })} />
        </Field>
      </div>
      {form.points.map((point, index) => (
        <Field key={index} label={`Dòng tích ${index + 1}`}>
          <Input value={point} onChange={(event) => patchPoint(index, event.target.value)} />
        </Field>
      ))}
      <Field label="Ảnh người bên phải" description="Để trống thì dùng hình minh họa. Nên dùng ảnh dọc, người nhìn điện thoại.">
        <div className="flex flex-wrap items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="h-20 w-16 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-20 w-16 items-center justify-center rounded-xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072348]">
            {uploading === 'photo' ? 'Đang tải…' : 'Tải ảnh'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploading === 'photo'}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void upload('photo', file);
              }}
            />
          </label>
          <button type="button" className="text-xs font-semibold text-[#072348]" onClick={() => setSlot('photo')}>
            Thư viện
          </button>
          {form.imageUrl ? (
            <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => patch({ imageUrl: '' })}>
              Dùng minh họa
            </button>
          ) : null}
        </div>
      </Field>
      <Field label="Tiêu đề thẻ việc làm">
        <Input value={form.cardTitle} onChange={(event) => patch({ cardTitle: event.target.value })} />
      </Field>
      {form.jobs.map((job, index) => {
        const avatar = resolveCmsAssetUrl(job.avatarUrl);
        const target: Slot = `job:${index}`;
        return (
          <div key={index} className="space-y-3 rounded-xl border border-rose-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Việc gợi ý {index + 1}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Chức danh">
                <Input value={job.title} onChange={(event) => patchJob(index, { title: event.target.value })} />
              </Field>
              <Field label="Điểm phù hợp">
                <Input value={job.score} onChange={(event) => patchJob(index, { score: event.target.value })} />
              </Field>
              <Field label="Công ty">
                <Input value={job.company} onChange={(event) => patchJob(index, { company: event.target.value })} />
              </Field>
              <Field label="Địa điểm">
                <Input value={job.location} onChange={(event) => patchJob(index, { location: event.target.value })} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {avatar ? (
                <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072348]">
                {uploading === target ? 'Đang tải…' : 'Tải ảnh chân dung'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploading === target}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void upload(target, file);
                  }}
                />
              </label>
              <button type="button" className="text-xs font-semibold text-[#072348]" onClick={() => setSlot(target)}>
                Thư viện
              </button>
              {job.avatarUrl ? (
                <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => patchJob(index, { avatarUrl: '' })}>
                  Dùng chữ
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Đã lưu khối ứng viên.</p> : null}
      <Button type="submit" disabled={save.isPending}>
        <Save className="h-4 w-4" />
        {save.isPending ? 'Đang lưu…' : 'Lưu khối ứng viên'}
      </Button>
      <CmsMediaPicker
        open={slot != null}
        onClose={() => setSlot(null)}
        onSelect={(url) => {
          if (slot) applyUrl(slot, url);
          setSlot(null);
        }}
      />
    </form>
  );
}
