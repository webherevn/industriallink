'use client';

import {
  cloneDefaultStructuredFooter,
  normalizeStructuredFooter,
  type CmsFooterColumnGroup,
  type CmsFooterLink,
  type CmsFooterSocial,
  type CmsFooterSocialPlatform,
  type CmsStructuredFooter,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Columns3,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getCmsFooterAdmin, saveCmsFooterAdmin, uploadCmsMedia } from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

const SOCIAL_PLATFORMS: Array<{ value: CmsFooterSocialPlatform; label: string }> = [
  { value: 'facebook', label: 'Facebook Fanpage' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'threads', label: 'Threads' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'other', label: 'Khác' },
];

export function AdminFooterPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-footer'],
    queryFn: getCmsFooterAdmin,
  });

  const [structured, setStructured] = useState<CmsStructuredFooter>(cloneDefaultStructuredFooter);
  const [copyrightText, setCopyrightText] = useState(
    '©2026 Inlink Vietnam JSC. All rights reserved.',
  );
  const [uploadingBadge, setUploadingBadge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStructured(
      data.structured
        ? normalizeStructuredFooter(data.structured)
        : cloneDefaultStructuredFooter(),
    );
    setCopyrightText(data.copyrightText || '©2026 Inlink Vietnam JSC. All rights reserved.');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveCmsFooterAdmin({
        structured: normalizeStructuredFooter(structured),
        copyrightText: copyrightText.trim() || '©2026 Inlink Vietnam JSC. All rights reserved.',
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-footer'] });
      await qc.invalidateQueries({ queryKey: ['public-cms-footer'] });
      if (res.structured) setStructured(normalizeStructuredFooter(res.structured));
      setCopyrightText(res.copyrightText);
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu chân trang thất bại');
    },
  });

  function updateColumn(colIdx: number, updater: (col: CmsFooterColumnGroup) => CmsFooterColumnGroup) {
    setStructured((prev) => ({
      ...prev,
      columns: prev.columns.map((c, i) => (i === colIdx ? updater(c) : c)),
    }));
  }

  function updateLink(colIdx: number, linkIdx: number, patch: Partial<CmsFooterLink>) {
    updateColumn(colIdx, (col) => ({
      ...col,
      links: col.links.map((l, i) => (i === linkIdx ? { ...l, ...patch } : l)),
    }));
  }

  function updateSocial(idx: number, patch: Partial<CmsFooterSocial>) {
    setStructured((prev) => ({
      ...prev,
      socials: prev.socials.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function updateBottomLink(idx: number, patch: Partial<CmsFooterLink>) {
    setStructured((prev) => ({
      ...prev,
      bottomLinks: prev.bottomLinks.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  async function handleUploadBadge(file: File) {
    setUploadingBadge(true);
    setError(null);
    try {
      const res = await uploadCmsMedia(file);
      setStructured((prev) => ({ ...prev, bctBadgeImageUrl: res.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tải ảnh huy hiệu thất bại');
    } finally {
      setUploadingBadge(false);
    }
  }

  const badgePreview = resolveCmsAssetUrl(structured.bctBadgeImageUrl);

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">
            Cấu hình · CMS
          </p>
          <h1 className="cms-page-title mt-1.5">Chân trang chuẩn inLink</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-2xl">
            Quản trị toàn bộ thông tin liên hệ, mạng xã hội, 4 cột điều hướng &amp; chính sách, pháp lý doanh nghiệp và huy hiệu Bộ Công Thương trực tiếp — không cần sửa code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => {
              if (!window.confirm('Khôi phục toàn bộ cột link & chính sách về mẫu chuẩn inLink?')) {
                return;
              }
              const def = cloneDefaultStructuredFooter();
              setStructured((prev) => ({
                ...def,
                companyName: prev.companyName || def.companyName,
                email: prev.email || def.email,
                hotline: prev.hotline,
                zaloUrl: prev.zaloUrl || def.zaloUrl,
                socials: prev.socials.length ? prev.socials : def.socials,
                address: prev.address,
                taxCode: prev.taxCode,
                licenseInfo: prev.licenseInfo,
                bctBadgeUrl: prev.bctBadgeUrl,
                bctBadgeImageUrl: prev.bctBadgeImageUrl,
              }));
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Khôi phục mẫu chuẩn
          </button>
          <button
            type="button"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Đang lưu…' : 'Lưu chân trang'}
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
          Đã lưu cấu hình chân trang — giao diện công khai sẽ tự cập nhật ngay.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="admin-dash-skel h-28" />
          <div className="admin-dash-skel h-40" />
          <div className="admin-dash-skel h-24" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* 1. Thương hiệu, Liên hệ & Mạng xã hội */}
          <CmsCollapsiblePanel title="1. Thương hiệu, Liên hệ & Mạng xã hội (Cột 1)" tone="dash" defaultOpen>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Slogan dưới Logo">
                  <Input
                    value={structured.slogan}
                    onChange={(e) => setStructured((p) => ({ ...p, slogan: e.target.value }))}
                    placeholder="Nền tảng kết nối đúng người, đúng công việc bằng AI Matching..."
                  />
                </Field>
              </div>
              <Field label="Email hỗ trợ">
                <Input
                  value={structured.email}
                  onChange={(e) => setStructured((p) => ({ ...p, email: e.target.value }))}
                  placeholder="hotro@inlink.vn"
                />
              </Field>
              <Field label="Hotline (để trống sẽ tự ẩn)">
                <Input
                  value={structured.hotline}
                  onChange={(e) => setStructured((p) => ({ ...p, hotline: e.target.value }))}
                  placeholder="VD: 1900 6868 hoặc 09xx xxx xxx"
                />
              </Field>
              <Field label="Nhãn nút Zalo hỗ trợ">
                <Input
                  value={structured.zaloLabel}
                  onChange={(e) => setStructured((p) => ({ ...p, zaloLabel: e.target.value }))}
                  placeholder="Zalo hỗ trợ ứng viên"
                />
              </Field>
              <Field label="Link Zalo (để trống sẽ ẩn nút)">
                <Input
                  value={structured.zaloUrl}
                  onChange={(e) => setStructured((p) => ({ ...p, zaloUrl: e.target.value }))}
                  placeholder="https://zalo.me/..."
                />
              </Field>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#072348]">Kênh mạng xã hội</p>
                <button
                  type="button"
                  onClick={() =>
                    setStructured((p) => ({
                      ...p,
                      socials: [
                        ...p.socials,
                        { platform: 'facebook', label: 'Inlink Vietnam', href: 'https://' },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#072348] hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm kênh
                </button>
              </div>
              <div className="mt-3 space-y-2.5">
                {structured.socials.map((s, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 sm:grid-cols-[160px_1fr_1.4fr_auto]"
                  >
                    <Select
                      value={s.platform}
                      onChange={(e) =>
                        updateSocial(idx, { platform: e.target.value as CmsFooterSocialPlatform })
                      }
                    >
                      {SOCIAL_PLATFORMS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={s.label}
                      onChange={(e) => updateSocial(idx, { label: e.target.value })}
                      placeholder="Tên hiển thị (VD: Inlink Vietnam)"
                    />
                    <Input
                      value={s.href}
                      onChange={(e) => updateSocial(idx, { href: e.target.value })}
                      placeholder="https://..."
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setStructured((p) => ({
                          ...p,
                          socials: p.socials.filter((_, i) => i !== idx),
                        }))
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Xoá kênh này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CmsCollapsiblePanel>

          {/* 2. 4 Cột liên kết điều hướng & chính sách */}
          <CmsCollapsiblePanel title="2. Các cột liên kết & Chính sách (Cột 2–5)" tone="dash" defaultOpen>
            <p className="mb-4 flex items-center gap-2 text-xs text-slate-500">
              <Columns3 className="h-4 w-4 text-[#E8872A]" />
              Các bài chính sách dùng đường dẫn dạng <code className="rounded bg-slate-100 px-1">/trang/ten-bai</code> để tự khớp với Trang tĩnh CMS khi bạn tạo bài.
            </p>
            <div className="space-y-4">
              {structured.columns.map((col, colIdx) => (
                <div
                  key={colIdx}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="w-full max-w-sm">
                      <Field label={`Tiêu đề Cột ${colIdx + 2}`}>
                        <Input
                          value={col.title}
                          onChange={(e) =>
                            updateColumn(colIdx, (c) => ({ ...c, title: e.target.value }))
                          }
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateColumn(colIdx, (c) => ({
                          ...c,
                          links: [...c.links, { label: 'Liên kết mới', href: '/trang/' }],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#072348] hover:bg-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" /> Thêm liên kết
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {col.links.map((link, linkIdx) => (
                      <div
                        key={linkIdx}
                        className="grid items-center gap-2 sm:grid-cols-[1fr_1.2fr_auto_auto]"
                      >
                        <Input
                          value={link.label}
                          onChange={(e) => updateLink(colIdx, linkIdx, { label: e.target.value })}
                          placeholder="Tên hiển thị"
                        />
                        <Input
                          value={link.href}
                          onChange={(e) => updateLink(colIdx, linkIdx, { href: e.target.value })}
                          placeholder="/trang/gioi-thieu hoặc https://..."
                        />
                        <label className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(link.external)}
                            onChange={(e) =>
                              updateLink(colIdx, linkIdx, { external: e.target.checked })
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-[#E8872A]"
                          />
                          Tab mới
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateColumn(colIdx, (c) => ({
                              ...c,
                              links: c.links.filter((_, i) => i !== linkIdx),
                            }))
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Xoá liên kết"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CmsCollapsiblePanel>

          {/* 3. Pháp lý Doanh nghiệp & Bộ Công Thương */}
          <CmsCollapsiblePanel title="3. Pháp lý Doanh nghiệp & Chứng nhận Bộ Công Thương" tone="dash" defaultOpen>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tên pháp nhân công ty">
                <Input
                  value={structured.companyName}
                  onChange={(e) => setStructured((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="CÔNG TY CỔ PHẦN GIẢI PHÁP INLINK"
                />
              </Field>
              <Field label="Mã số doanh nghiệp / MST (để trống sẽ ẩn)">
                <Input
                  value={structured.taxCode}
                  onChange={(e) => setStructured((p) => ({ ...p, taxCode: e.target.value }))}
                  placeholder="VD: 010xxxxxxx do Sở KH&ĐT cấp"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Địa chỉ trụ sở (để trống sẽ ẩn)">
                  <Input
                    value={structured.address}
                    onChange={(e) => setStructured((p) => ({ ...p, address: e.target.value }))}
                    placeholder="VD: Tầng X, Tòa nhà..., Quận..., Hà Nội"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Giấy phép hoạt động dịch vụ việc làm (nếu có)">
                  <Input
                    value={structured.licenseInfo}
                    onChange={(e) => setStructured((p) => ({ ...p, licenseInfo: e.target.value }))}
                    placeholder="VD: Giấy phép hoạt động dịch vụ việc làm số..."
                  />
                </Field>
              </div>
              <Field label="Link trang xác nhận Bộ Công Thương (online.gov.vn)">
                <Input
                  value={structured.bctBadgeUrl}
                  onChange={(e) => setStructured((p) => ({ ...p, bctBadgeUrl: e.target.value }))}
                  placeholder="http://online.gov.vn/Home/WebDetails/..."
                />
              </Field>
              <Field label="Ảnh huy hiệu Bộ Công Thương (URL hoặc tải lên)">
                <div className="flex items-center gap-2">
                  <Input
                    value={structured.bctBadgeImageUrl}
                    onChange={(e) =>
                      setStructured((p) => ({ ...p, bctBadgeImageUrl: e.target.value }))
                    }
                    placeholder="/api/v1/cms/media/..."
                  />
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#072348] hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingBadge ? 'Đang tải…' : 'Tải ảnh'}
                    <input
                      type="file"
                      accept="image/png,image/webp,image/jpeg"
                      className="hidden"
                      disabled={uploadingBadge}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void handleUploadBadge(file);
                      }}
                    />
                  </label>
                </div>
              </Field>
            </div>
            {badgePreview ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badgePreview} alt="Huy hiệu BCT" className="h-10 w-auto object-contain" />
                <button
                  type="button"
                  onClick={() => setStructured((p) => ({ ...p, bctBadgeImageUrl: '' }))}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Gỡ ảnh huy hiệu
                </button>
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Khi chưa tải ảnh huy hiệu Bộ Công Thương, chân trang vẫn hiển thị nhãn bảo mật NĐ 13/2023/NĐ-CP gọn gàng.
              </p>
            )}
          </CmsCollapsiblePanel>

          {/* 4. Copyright & Liên kết nhanh cuối trang */}
          <CmsCollapsiblePanel title="4. Bản quyền & Liên kết nhanh dưới cùng" tone="dash" defaultOpen>
            <Field label="Nội dung Copyright">
              <Input
                value={copyrightText}
                onChange={(e) => setCopyrightText(e.target.value)}
                placeholder="©2026 Inlink Vietnam JSC. All rights reserved."
                maxLength={500}
              />
            </Field>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#072348]">
                  <Building2 className="h-3.5 w-3.5 text-[#E8872A]" />
                  Liên kết nhanh bên phải Copyright
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setStructured((p) => ({
                      ...p,
                      bottomLinks: [...p.bottomLinks, { label: 'Chính sách', href: '/trang/' }],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#072348] hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </button>
              </div>
              <div className="mt-2.5 space-y-2">
                {structured.bottomLinks.map((link, idx) => (
                  <div key={idx} className="grid items-center gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                    <Input
                      value={link.label}
                      onChange={(e) => updateBottomLink(idx, { label: e.target.value })}
                      placeholder="VD: Điều khoản"
                    />
                    <Input
                      value={link.href}
                      onChange={(e) => updateBottomLink(idx, { href: e.target.value })}
                      placeholder="/trang/dieu-khoan-dich-vu"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setStructured((p) => ({
                          ...p,
                          bottomLinks: p.bottomLinks.filter((_, i) => i !== idx),
                        }))
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CmsCollapsiblePanel>
        </div>
      )}
    </AdminShell>
  );
}
