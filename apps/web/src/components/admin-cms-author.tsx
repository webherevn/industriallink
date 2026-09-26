'use client';

import {
  cmsAuthorPublicPath,
  UserRole,
  type CmsAuthorProfileView,
  type UpsertCmsAuthorProfileRequest,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ExternalLink, ImageIcon, Plus, UserPlus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  assignCmsAuthorProfile,
  getCmsAuthorProfile,
  listCmsAuthorProfiles,
  listEligibleAuthorUsers,
  updateCmsAuthorProfile,
  updateCmsAuthorProfileByUser,
  uploadCmsMedia,
} from '@/lib/admin-cms';
import { fetchMe } from '@/lib/auth';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import { BRAND_NAME } from '@/lib/brand';

type FormState = UpsertCmsAuthorProfileRequest & {
  userId: string;
  email?: string | null;
};

const emptyForm = (userId = ''): FormState => ({
  userId,
  displayName: '',
  title: '',
  bio: '',
  avatarUrl: '',
  worksFor: BRAND_NAME,
  slug: '',
  isPublic: true,
  websiteUrl: '',
  facebookUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  youtubeUrl: '',
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
});

function profileToForm(p: CmsAuthorProfileView): FormState {
  return {
    userId: p.userId,
    email: p.email,
    displayName: p.displayName,
    title: p.title ?? '',
    bio: p.bio ?? '',
    avatarUrl: p.avatarUrl ?? '',
    worksFor: p.worksFor ?? BRAND_NAME,
    slug: p.slug ?? '',
    isPublic: p.isPublic,
    websiteUrl: p.social.website ?? '',
    facebookUrl: p.social.facebook ?? '',
    linkedinUrl: p.social.linkedin ?? '',
    twitterUrl: p.social.twitter ?? '',
    youtubeUrl: p.social.youtube ?? '',
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    focusKeyword: p.focusKeyword ?? '',
    canonicalPath: p.canonicalPath ?? '',
    ogTitle: p.ogTitle ?? '',
    ogDescription: p.ogDescription ?? '',
    ogImageUrl: p.ogImageUrl ?? '',
    robotsIndex: p.robotsIndex,
    robotsFollow: p.robotsFollow,
    robotsMaxImagePreview: p.robotsMaxImagePreview,
  };
}

function toPayload(form: FormState): UpsertCmsAuthorProfileRequest {
  const t = (v?: string | null) => (v?.trim() ? v.trim() : null);
  return {
    displayName: form.displayName.trim(),
    title: t(form.title),
    bio: t(form.bio),
    avatarUrl: t(form.avatarUrl),
    worksFor: t(form.worksFor),
    slug: t(form.slug),
    isPublic: form.isPublic,
    websiteUrl: t(form.websiteUrl),
    facebookUrl: t(form.facebookUrl),
    linkedinUrl: t(form.linkedinUrl),
    twitterUrl: t(form.twitterUrl),
    youtubeUrl: t(form.youtubeUrl),
    seoTitle: t(form.seoTitle),
    seoDescription: t(form.seoDescription),
    focusKeyword: t(form.focusKeyword),
    canonicalPath: t(form.canonicalPath),
    ogTitle: t(form.ogTitle),
    ogDescription: t(form.ogDescription),
    ogImageUrl: t(form.ogImageUrl),
    robotsIndex: form.robotsIndex ?? true,
    robotsFollow: form.robotsFollow ?? true,
    robotsMaxImagePreview: form.robotsMaxImagePreview ?? true,
  };
}

export function AdminAuthorProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const isSuper = me?.role === UserRole.SuperAdmin;

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['admin-cms-author-profiles'],
    queryFn: listCmsAuthorProfiles,
    enabled: isSuper,
  });
  const { data: eligible = [] } = useQuery({
    queryKey: ['admin-cms-author-eligible'],
    queryFn: listEligibleAuthorUsers,
    enabled: isSuper,
  });
  const { data: myProfile, isLoading: myLoading } = useQuery({
    queryKey: ['admin-cms-author-profile'],
    queryFn: getCmsAuthorProfile,
    enabled: Boolean(me) && !isSuper,
  });

  const [mode, setMode] = useState<'list' | 'edit' | 'assign'>('list');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isSuper && myProfile) {
      setForm(profileToForm(myProfile));
      setMode('edit');
    }
  }, [isSuper, myProfile]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = toPayload(form);
      if (!body.displayName) throw new ApiError(400, 'Thiếu tên hiển thị');
      if (!body.title) throw new ApiError(400, 'Chức danh là bắt buộc');
      if (!isSuper) return updateCmsAuthorProfile(body);
      if (mode === 'assign') {
        if (!form.userId) throw new ApiError(400, 'Chọn tài khoản');
        return assignCmsAuthorProfile({ ...body, userId: form.userId });
      }
      return updateCmsAuthorProfileByUser(form.userId, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-author-profiles'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-author-eligible'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-author-profile'] });
      setError(null);
      if (isSuper) setMode('list');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  async function onAvatarFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadCmsMedia(file);
      patch('avatarUrl', res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  }

  const avatarSrc = resolveCmsAssetUrl(form.avatarUrl) || form.avatarUrl;
  const publicHref = form.slug ? cmsAuthorPublicPath(form.slug) : null;

  useEffect(() => {
    if (mode === 'list') setError(null);
  }, [mode]);

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">CMS & SEO</p>
          <h1 className="cms-page-title mt-1.5">Hồ sơ tác giả</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            {isSuper
              ? 'Gán tài khoản viết bài và trang public '
              : 'Thông tin hiển thị trên bài viết và trang '}
            <span className="font-medium text-[#072348]">/tac-gia/&#123;slug&#125;</span>
            {' '}· Schema Person.
          </p>
        </div>
        {isSuper && mode === 'list' ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            onClick={() => {
              setForm(emptyForm());
              setMode('assign');
            }}
            disabled={eligible.length === 0}
          >
            <UserPlus className="h-4 w-4" />
            Gán tài khoản
          </button>
        ) : isSuper ? (
          <button
            type="button"
            onClick={() => setMode('list')}
            className="admin-dash-card inline-flex items-center px-3.5 py-2.5 text-sm font-semibold text-[#072348]"
          >
            ← Danh sách
          </button>
        ) : null}
      </div>

      {!isSuper && myLoading ? (
        <div className="mt-6 space-y-3">
          <div className="admin-dash-skel h-28" />
          <div className="admin-dash-skel h-64" />
        </div>
      ) : null}

      {isSuper && mode === 'list' && (
        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="admin-dash-skel h-24" />
              <div className="admin-dash-skel h-24" />
              <div className="admin-dash-skel h-24" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="admin-dash-card admin-dash-rise px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
                <UserRound className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#072348]">Chưa có hồ sơ tác giả</p>
              <p className="mt-1 text-xs text-slate-500">
                Gán tài khoản để tạo trang /tac-gia/… và Schema Person.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {profiles.map((p, index) => {
                const av = resolveCmsAssetUrl(p.avatarUrl) || p.avatarUrl;
                const live = Boolean(p.isPublic && p.slug);
                return (
                  <li key={p.userId} className="admin-dash-rise" style={{ animationDelay: `${index * 50}ms` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(profileToForm(p));
                        setMode('edit');
                      }}
                      className="admin-dash-card admin-dash-lift flex w-full items-start gap-3 p-4 text-left"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#072348] text-white ring-2 ring-[#FFD0A3]">
                        {av ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={av} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#072348]">{p.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{p.title || '—'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                              live
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                                : 'bg-[#FFF8F1] text-[#072348] ring-[#FFD0A3]',
                            )}
                          >
                            {live ? 'Public' : 'Ẩn'}
                          </span>
                          {p.slug ? (
                            <span className="truncate text-[10px] text-slate-400">/{p.slug}</span>
                          ) : null}
                          <span className="text-[10px] text-slate-400">{p.postCount ?? 0} bài</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {(mode === 'edit' || mode === 'assign') && (isSuper || !myLoading) && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          {mode === 'assign' && (
            <div className="admin-dash-card admin-dash-rise space-y-3 p-5">
              <h2 className="text-sm font-semibold text-[#072348]">Chọn tài khoản</h2>
              <Field label="Tài khoản được phép viết bài">
                <Select
                  value={form.userId}
                  onChange={(e) => {
                    const u = eligible.find((x) => x.id === e.target.value);
                    setForm((f) => ({
                      ...f,
                      userId: e.target.value,
                      displayName: u?.displayName || f.displayName,
                      email: u?.email,
                    }));
                  }}
                  required
                >
                  <option value="">— Chọn user —</option>
                  {eligible.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.email}) · {u.role}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="admin-dash-card admin-dash-rise h-fit space-y-3 p-5">
              <h2 className="text-sm font-semibold text-[#072348]">Ảnh đại diện</h2>
              <div className="flex flex-col items-center gap-3">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-28 w-28 rounded-full object-cover shadow-[0_16px_32px_-18px_rgba(7,35,72,0.7)] ring-2 ring-[#FFD0A3]"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#072348] text-white shadow-[0_16px_32px_-18px_rgba(7,35,72,0.7)] ring-2 ring-[#FFD0A3]">
                    <UserRound className="h-12 w-12" />
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#072348] shadow-sm transition hover:border-[#FFD0A3] hover:bg-[#FFF8F1]">
                  <ImageIcon className="h-3.5 w-3.5 text-[#E8872A]" />
                  {uploading ? 'Đang tải…' : 'Tải ảnh'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = '';
                      void onAvatarFile(f);
                    }}
                  />
                </label>
              </div>
              {form.email && (
                <p className="text-center text-[11px] text-slate-400">{form.email}</p>
              )}
              {publicHref && form.isPublic && (
                <Link
                  href={publicHref}
                  target="_blank"
                  className="inline-flex w-full items-center justify-center gap-1 text-xs font-semibold text-[#E8872A]"
                >
                  Xem trang public <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </aside>

            <div className="space-y-3">
              <CmsCollapsiblePanel title="Thông tin cơ bản" tone="dash" defaultOpen>
                <Field label="Tên hiển thị *">
                  <Input
                    value={form.displayName}
                    onChange={(e) => patch('displayName', e.target.value)}
                    required
                  />
                </Field>
                <Field label="Chức danh (Job Title) *">
                  <Input
                    value={form.title ?? ''}
                    onChange={(e) => patch('title', e.target.value)}
                    placeholder="VD: Chuyên gia Tuyển dụng B2B"
                    required
                  />
                </Field>
                <Field label="Tổ chức (worksFor)">
                  <Input
                    value={form.worksFor ?? ''}
                    onChange={(e) => patch('worksFor', e.target.value)}
                    placeholder={BRAND_NAME}
                  />
                </Field>
                <Field label="Tiểu sử ngắn">
                  <textarea
                    className="cms-field-control min-h-[100px]"
                    value={form.bio ?? ''}
                    onChange={(e) => patch('bio', e.target.value)}
                    placeholder="1–2 đoạn kinh nghiệm chuyên môn (E-E-A-T)"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Slug trang /tac-gia/…">
                    <Input
                      value={form.slug ?? ''}
                      onChange={(e) => patch('slug', e.target.value)}
                      placeholder="nguyen-van-a"
                    />
                  </Field>
                  <Field label="Trang public">
                    <Select
                      value={form.isPublic ? '1' : '0'}
                      onChange={(e) => patch('isPublic', e.target.value === '1')}
                    >
                      <option value="1">Công khai</option>
                      <option value="0">Ẩn</option>
                    </Select>
                  </Field>
                </div>
              </CmsCollapsiblePanel>

              <CmsCollapsiblePanel title="Mạng xã hội (sameAs)" tone="dash" defaultOpen={false}>
                <p className="text-xs text-slate-500">
                  LinkedIn quan trọng nhất cho B2B. Chỉ URL https:// — Schema không in giá trị
                  rỗng.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="LinkedIn">
                    <Input
                      value={form.linkedinUrl ?? ''}
                      onChange={(e) => patch('linkedinUrl', e.target.value)}
                      placeholder="https://linkedin.com/in/…"
                    />
                  </Field>
                  <Field label="Website">
                    <Input
                      value={form.websiteUrl ?? ''}
                      onChange={(e) => patch('websiteUrl', e.target.value)}
                      placeholder="https://"
                    />
                  </Field>
                  <Field label="Facebook">
                    <Input
                      value={form.facebookUrl ?? ''}
                      onChange={(e) => patch('facebookUrl', e.target.value)}
                    />
                  </Field>
                  <Field label="X / Twitter">
                    <Input
                      value={form.twitterUrl ?? ''}
                      onChange={(e) => patch('twitterUrl', e.target.value)}
                    />
                  </Field>
                  <Field label="YouTube" className="sm:col-span-2">
                    <Input
                      value={form.youtubeUrl ?? ''}
                      onChange={(e) => patch('youtubeUrl', e.target.value)}
                    />
                  </Field>
                </div>
              </CmsCollapsiblePanel>

              <CmsCollapsiblePanel title="SEO trang tác giả" tone="dash" defaultOpen={false}>
                <Field label="Focus keyphrase">
                  <Input
                    value={form.focusKeyword ?? ''}
                    onChange={(e) => patch('focusKeyword', e.target.value)}
                  />
                </Field>
                <Field label="SEO Title">
                  <Input
                    value={form.seoTitle ?? ''}
                    onChange={(e) => patch('seoTitle', e.target.value)}
                    placeholder="Để trống = Tên · Chức danh"
                  />
                </Field>
                <Field label="SEO Description">
                  <textarea
                    className="cms-field-control min-h-[72px]"
                    value={form.seoDescription ?? ''}
                    onChange={(e) => patch('seoDescription', e.target.value)}
                    placeholder="Để trống = tiểu sử"
                  />
                </Field>
                <Field label="Canonical">
                  <Input
                    value={form.canonicalPath ?? ''}
                    onChange={(e) => patch('canonicalPath', e.target.value)}
                    placeholder="Để trống = /tac-gia/{slug}"
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
                <Field label="OG Title">
                  <Input
                    value={form.ogTitle ?? ''}
                    onChange={(e) => patch('ogTitle', e.target.value)}
                  />
                </Field>
                <Field label="OG Description">
                  <Input
                    value={form.ogDescription ?? ''}
                    onChange={(e) => patch('ogDescription', e.target.value)}
                  />
                </Field>
                <Field label="OG Image">
                  <Input
                    value={form.ogImageUrl ?? ''}
                    onChange={(e) => patch('ogImageUrl', e.target.value)}
                    placeholder="Để trống = avatar"
                  />
                </Field>
              </CmsCollapsiblePanel>

              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#072348] transition hover:border-[#FFD0A3] hover:bg-[#FFF8F1]"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  disabled={saveMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                  {saveMutation.isPending ? 'Đang lưu…' : mode === 'assign' ? 'Gán & tạo' : 'Lưu hồ sơ'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
