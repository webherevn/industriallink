'use client';

import {
  DEFAULT_HOMEPAGE_HERO,
  normalizeHomepageHero,
  type HomepageHeroContent,
  type HomepageHeroJob,
  type HomepageHeroPerson,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsMediaPicker } from '@/components/cms-media-library';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { AdminHomepageReasonsForm } from '@/components/admin-homepage-reasons';
import { getCmsHomepageAdmin, saveHomepageHeroAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

type Slot = 'banner' | `person:${number}` | `job:${number}`;

function cloneHero(hero: HomepageHeroContent): HomepageHeroContent {
  return normalizeHomepageHero(hero);
}

function ImageSlot({
  url,
  label,
  onUpload,
  onPick,
  onClear,
  busy,
}: {
  url: string;
  label: string;
  onUpload: (file: File) => void;
  onPick: () => void;
  onClear: () => void;
  busy: boolean;
}) {
  const src = resolveCmsAssetUrl(url);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {src ? (
        <img src={src} alt="" className="h-16 w-24 rounded-xl object-cover ring-1 ring-slate-200" />
      ) : (
        <div className="flex h-16 w-24 items-center justify-center rounded-xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] text-[#E8872A]">
          <ImageIcon className="h-4 w-4" />
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072348]">
        {busy ? 'Đang tải…' : label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onUpload(file);
          }}
        />
      </label>
      <button type="button" className="text-xs font-semibold text-[#072348]" onClick={onPick}>
        Thư viện
      </button>
      {url ? (
        <button type="button" className="text-xs font-semibold text-rose-600" onClick={onClear}>
          Xoá
        </button>
      ) : null}
    </div>
  );
}

export function AdminHomepageHeroPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin-cms-homepage'], queryFn: getCmsHomepageAdmin });
  const [form, setForm] = useState<HomepageHeroContent>(cloneHero(DEFAULT_HOMEPAGE_HERO));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [uploading, setUploading] = useState<Slot | null>(null);

  useEffect(() => {
    if (query.data?.hero) setForm(cloneHero(query.data.hero));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveHomepageHeroAdmin(normalizeHomepageHero(form)),
    onSuccess: async (view) => {
      setForm(cloneHero(view.hero));
      setSaved(true);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-cms-homepage'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không lưu được banner'),
  });

  function patch(partial: Partial<HomepageHeroContent>) {
    setSaved(false);
    setForm((current) => ({ ...current, ...partial }));
  }

  function patchPerson(index: number, partial: Partial<HomepageHeroPerson>) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      candidates: current.candidates.map((person, i) => (i === index ? { ...person, ...partial } : person)),
    }));
  }

  function patchJob(index: number, partial: Partial<HomepageHeroJob>) {
    setSaved(false);
    setForm((current) => ({
      ...current,
      jobs: current.jobs.map((job, i) => (i === index ? { ...job, ...partial } : job)),
    }));
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

  function applyUrl(target: Slot, url: string) {
    setSaved(false);
    if (target === 'banner') {
      patch({ imageUrl: url });
      return;
    }
    const [kind, indexRaw] = target.split(':');
    const index = Number(indexRaw);
    if (kind === 'person') patchPerson(index, { avatarUrl: url });
    if (kind === 'job') patchJob(index, { iconUrl: url });
  }

  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Trang chủ</p>
        <h1 className="cms-page-title mt-1.5">Trang chủ</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-xl">
          Sửa banner đầu trang và khối lý do ngay dưới danh sách việc làm.
        </p>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          save.mutate();
        }}
      >
        <section className="admin-dash-card space-y-4 p-5">
          <h2 className="text-sm font-bold text-[#072348]">Chữ banner</h2>
          <Field label="Dòng nhỏ phía trên">
            <Input value={form.eyebrow} onChange={(event) => patch({ eyebrow: event.target.value })} />
          </Field>
          <Field label="Tiêu đề" description="Mỗi dòng một hàng. Cụm tô cam phải nằm đúng trong tiêu đề.">
            <textarea
              className="cms-field-control min-h-[96px]"
              value={form.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </Field>
          <Field label="Cụm chữ màu cam">
            <Input value={form.titleAccent} onChange={(event) => patch({ titleAccent: event.target.value })} />
          </Field>
          <Field label="Đoạn mô tả">
            <textarea
              className="cms-field-control min-h-[88px]"
              value={form.subtitle}
              onChange={(event) => patch({ subtitle: event.target.value })}
            />
          </Field>
        </section>

        <section className="admin-dash-card space-y-4 p-5">
          <h2 className="text-sm font-bold text-[#072348]">Hai nút</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nút cam — nhãn">
              <Input value={form.primaryLabel} onChange={(event) => patch({ primaryLabel: event.target.value })} />
            </Field>
            <Field label="Nút cam — dòng phụ">
              <Input value={form.primaryHint} onChange={(event) => patch({ primaryHint: event.target.value })} />
            </Field>
            <Field label="Nút cam — đường dẫn">
              <Input value={form.primaryHref} onChange={(event) => patch({ primaryHref: event.target.value })} />
            </Field>
            <Field label="Nút trắng — nhãn">
              <Input value={form.secondaryLabel} onChange={(event) => patch({ secondaryLabel: event.target.value })} />
            </Field>
            <Field label="Nút trắng — dòng phụ">
              <Input value={form.secondaryHint} onChange={(event) => patch({ secondaryHint: event.target.value })} />
            </Field>
            <Field label="Nút trắng — đường dẫn">
              <Input value={form.secondaryHref} onChange={(event) => patch({ secondaryHref: event.target.value })} />
            </Field>
          </div>
        </section>

        <section className="admin-dash-card space-y-4 p-5">
          <h2 className="text-sm font-bold text-[#072348]">Ảnh người / nhà máy</h2>
          <p className="text-xs text-slate-500">Ảnh nằm bên phải banner. Thẻ ứng viên và việc làm đè lên phía dưới ảnh.</p>
          <ImageSlot
            url={form.imageUrl}
            label="Tải ảnh"
            busy={uploading === 'banner'}
            onUpload={(file) => void upload('banner', file)}
            onPick={() => setSlot('banner')}
            onClear={() => patch({ imageUrl: '' })}
          />
        </section>

        <section className="admin-dash-card space-y-4 p-5">
          <Field label="Tiêu đề thẻ ứng viên">
            <Input value={form.candidatesTitle} onChange={(event) => patch({ candidatesTitle: event.target.value })} />
          </Field>
          {form.candidates.map((person, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ứng viên {index + 1}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tên">
                  <Input value={person.name} onChange={(event) => patchPerson(index, { name: event.target.value })} />
                </Field>
                <Field label="Điểm %">
                  <Input value={person.score} onChange={(event) => patchPerson(index, { score: event.target.value })} />
                </Field>
              </div>
              <Field label="Dòng phụ" description="Xuống dòng để tách chức danh và số năm.">
                <textarea
                  className="cms-field-control min-h-[72px]"
                  value={person.detail}
                  onChange={(event) => patchPerson(index, { detail: event.target.value })}
                />
              </Field>
              <Field label="Nhãn, cách nhau bởi dấu phẩy">
                <Input
                  value={person.tags.join(', ')}
                  onChange={(event) =>
                    patchPerson(index, {
                      tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    })
                  }
                />
              </Field>
              <ImageSlot
                url={person.avatarUrl}
                label="Ảnh chân dung"
                busy={uploading === `person:${index}`}
                onUpload={(file) => void upload(`person:${index}`, file)}
                onPick={() => setSlot(`person:${index}`)}
                onClear={() => patchPerson(index, { avatarUrl: '' })}
              />
            </div>
          ))}
        </section>

        <section className="admin-dash-card space-y-4 p-5">
          <Field label="Tiêu đề thẻ việc làm">
            <Input value={form.jobsTitle} onChange={(event) => patch({ jobsTitle: event.target.value })} />
          </Field>
          {form.jobs.map((job, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Việc {index + 1}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tên việc">
                  <Input value={job.title} onChange={(event) => patchJob(index, { title: event.target.value })} />
                </Field>
                <Field label="Điểm %">
                  <Input value={job.score} onChange={(event) => patchJob(index, { score: event.target.value })} />
                </Field>
                <Field label="Công ty">
                  <Input value={job.company} onChange={(event) => patchJob(index, { company: event.target.value })} />
                </Field>
                <Field label="Địa điểm">
                  <Input value={job.location} onChange={(event) => patchJob(index, { location: event.target.value })} />
                </Field>
              </div>
              <Field label="Nhãn, cách nhau bởi dấu phẩy">
                <Input
                  value={job.tags.join(', ')}
                  onChange={(event) =>
                    patchJob(index, {
                      tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    })
                  }
                />
              </Field>
              <ImageSlot
                url={job.iconUrl}
                label="Ảnh biểu tượng"
                busy={uploading === `job:${index}`}
                onUpload={(file) => void upload(`job:${index}`, file)}
                onPick={() => setSlot(`job:${index}`)}
                onClear={() => patchJob(index, { iconUrl: '' })}
              />
            </div>
          ))}
        </section>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-700">Đã lưu banner.</p> : null}
        <Button type="submit" disabled={save.isPending || query.isLoading}>
          <Save className="h-4 w-4" />
          {save.isPending ? 'Đang lưu…' : 'Lưu banner'}
        </Button>
      </form>

      <CmsMediaPicker
        open={slot != null}
        onClose={() => setSlot(null)}
        onSelect={(url) => {
          if (slot) applyUrl(slot, url);
          setSlot(null);
        }}
      />

      <AdminHomepageReasonsForm initial={query.data?.reasons ?? null} />
    </AdminShell>
  );
}
