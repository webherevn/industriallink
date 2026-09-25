'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  getCmsAuthorProfile,
  updateCmsAuthorProfile,
  uploadCmsMedia,
} from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

export function AdminAuthorProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-author-profile'],
    queryFn: getCmsAuthorProfile,
  });

  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.displayName);
    setTitle(data.title ?? '');
    setBio(data.bio ?? '');
    setAvatarUrl(data.avatarUrl ?? '');
    setWebsiteUrl(data.social.website ?? '');
    setFacebookUrl(data.social.facebook ?? '');
    setLinkedinUrl(data.social.linkedin ?? '');
    setTwitterUrl(data.social.twitter ?? '');
    setYoutubeUrl(data.social.youtube ?? '');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCmsAuthorProfile({
        displayName: displayName.trim(),
        title: title.trim() || null,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        twitterUrl: twitterUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-author-profile'] });
      setError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu hồ sơ thất bại');
    },
  });

  async function onAvatarFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadCmsMedia(file);
      setAvatarUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload avatar thất bại');
    } finally {
      setUploading(false);
    }
  }

  const avatarSrc = resolveCmsAssetUrl(avatarUrl) || avatarUrl;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title">Hồ sơ tác giả</h1>
          <p className="cms-page-subtitle">
            Giống WordPress Users → Profile. Bài đăng mới gắn tài khoản đang đăng nhập làm tác giả;
            thông tin hiển thị lấy từ hồ sơ này.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="cms-status-pill cms-status-pill--ok">Đã lưu</span>}
          <Button
            type="button"
            disabled={saveMutation.isPending || !displayName.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải hồ sơ…</p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-slate-900">Avatar</h2>
            <div className="flex flex-col items-center gap-3">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt=""
                  className="h-28 w-28 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand-50 text-brand-400">
                  <UserRound className="h-12 w-12" />
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <ImageIcon className="h-3.5 w-3.5" />
                {uploading ? 'Đang tải…' : 'Tải ảnh lên'}
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
              {avatarUrl && (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600 hover:underline"
                  onClick={() => setAvatarUrl('')}
                >
                  Xoá avatar
                </button>
              )}
            </div>
            {data?.email && (
              <p className="text-center text-[11px] text-slate-400">{data.email}</p>
            )}
          </Card>

          <div className="space-y-5">
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Thông tin hiển thị</h2>
              <Field label="Tên tác giả">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tên hiển thị trên bài viết"
                  required
                />
              </Field>
              <Field label="Chức danh">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Chuyên gia tuyển dụng kỹ thuật"
                />
              </Field>
              <Field label="Giới thiệu">
                <textarea
                  className="cms-field-control min-h-[120px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Bio ngắn — dùng cho E-E-A-T / hộp tác giả cuối bài"
                />
              </Field>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Mạng xã hội</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Website">
                  <Input
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://"
                  />
                </Field>
                <Field label="LinkedIn">
                  <Input
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/…"
                  />
                </Field>
                <Field label="X / Twitter">
                  <Input
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/…"
                  />
                </Field>
                <Field label="YouTube" className="sm:col-span-2">
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/…"
                  />
                </Field>
              </div>
            </Card>

            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
