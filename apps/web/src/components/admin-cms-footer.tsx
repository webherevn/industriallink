'use client';

import type { CmsFooterBlock, CmsFooterSettingsView } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { CmsRichEditor } from '@/components/cms-rich-editor';
import { Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getCmsFooterAdmin, saveCmsFooterAdmin } from '@/lib/admin-cms';

function emptyColumns(): CmsFooterBlock['columns'] {
  return [{ html: '' }, { html: '' }, { html: '' }, { html: '' }];
}

function emptyForm(): CmsFooterSettingsView {
  return {
    footer1: { enabled: true, columns: emptyColumns() },
    footer2: { enabled: false, columns: emptyColumns() },
    copyrightText: '©2026 Inlink Vietnam JSC. All rights reserved.',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeBlock(block?: CmsFooterBlock | null): CmsFooterBlock {
  const columns = emptyColumns();
  const src = block?.columns ?? [];
  for (let i = 0; i < 4; i++) {
    columns[i] = { html: src[i]?.html ?? '' };
  }
  return { enabled: Boolean(block?.enabled), columns };
}

function FooterBlockEditor({
  title,
  hint,
  block,
  onChange,
  defaultOpen,
}: {
  title: string;
  hint: string;
  block: CmsFooterBlock;
  onChange: (next: CmsFooterBlock) => void;
  defaultOpen?: boolean;
}) {
  return (
    <CmsCollapsiblePanel title={title} tone="dash" defaultOpen={defaultOpen}>
      <p className="text-xs text-slate-500">{hint}</p>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#072348]">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 accent-[#E8872A]"
          checked={block.enabled}
          onChange={(e) => onChange({ ...block, enabled: e.target.checked })}
        />
        Hiển thị {title} trên site
      </label>

      {block.enabled ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((idx) => (
            <CmsCollapsiblePanel
              key={idx}
              title={`Cột ${idx + 1}`}
              tone="dash"
              defaultOpen={Boolean(block.columns[idx]?.html?.trim())}
            >
              <p className="mb-2 text-[11px] text-slate-400">
                Để trống để ẩn cột này trên giao diện công khai.
              </p>
              <CmsRichEditor
                value={block.columns[idx]?.html ?? ''}
                onChange={(html) => {
                  const columns = [...block.columns];
                  columns[idx] = { html };
                  onChange({ ...block, columns });
                }}
                compact
              />
            </CmsCollapsiblePanel>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-2 text-xs text-slate-500">
          Đang tắt — khối này không render trên trang public.
        </p>
      )}
    </CmsCollapsiblePanel>
  );
}

export function AdminFooterPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-footer'],
    queryFn: getCmsFooterAdmin,
  });
  const [form, setForm] = useState<CmsFooterSettingsView>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      footer1: normalizeBlock(data.footer1),
      footer2: normalizeBlock(data.footer2),
      copyrightText: data.copyrightText || emptyForm().copyrightText,
      updatedAt: data.updatedAt,
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveCmsFooterAdmin({
        footer1: normalizeBlock(form.footer1),
        footer2: normalizeBlock(form.footer2),
        copyrightText: form.copyrightText.trim(),
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-footer'] });
      await qc.invalidateQueries({ queryKey: ['public-cms-footer'] });
      setForm({
        footer1: normalizeBlock(res.footer1),
        footer2: normalizeBlock(res.footer2),
        copyrightText: res.copyrightText,
        updatedAt: res.updatedAt,
      });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Cấu hình</p>
          <h1 className="cms-page-title mt-1.5">Chân trang</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            Footer 1 và Footer 2, mỗi khối 4 cột. Bật hoặc tắt từng khối, rồi chỉnh dòng copyright.
          </p>
        </div>
        <button
          type="button"
          disabled={saveMutation.isPending || isLoading}
          onClick={() => saveMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Đang lưu…' : 'Lưu chân trang'}
        </button>
      </div>

      {error ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="admin-dash-rise mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Đã lưu cấu hình chân trang.
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          <div className="admin-dash-skel h-28" />
          <div className="admin-dash-skel h-40" />
          <div className="admin-dash-skel h-16" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="admin-dash-card admin-dash-rise flex items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF8F1] text-[#E8872A] ring-1 ring-[#FFD0A3]">
              <Columns3 className="h-4 w-4" />
            </span>
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-[#072348]">Cách hoạt động</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
                <li>Tắt cả khối Footer bằng checkbox «Hiển thị».</li>
                <li>Cột để trống HTML sẽ tự ẩn — grid co theo số cột còn nội dung.</li>
                <li>Hàng copyright luôn nằm dưới cùng.</li>
              </ul>
            </div>
          </div>

          <FooterBlockEditor
            title="Footer 1"
            hint="Khối chân trang chính — thường dùng cho giới thiệu, liên kết, liên hệ."
            block={form.footer1}
            onChange={(footer1) => setForm((f) => ({ ...f, footer1 }))}
            defaultOpen
          />

          <FooterBlockEditor
            title="Footer 2"
            hint="Khối phụ (tuỳ chọn) — ví dụ mạng xã hội, chứng nhận, CTA."
            block={form.footer2}
            onChange={(footer2) => setForm((f) => ({ ...f, footer2 }))}
            defaultOpen={form.footer2.enabled}
          />

          <CmsCollapsiblePanel title="Copyright (hàng dưới cùng)" tone="dash" defaultOpen>
            <Field label="Nội dung copyright">
              <Input
                value={form.copyrightText}
                onChange={(e) => setForm((f) => ({ ...f, copyrightText: e.target.value }))}
                placeholder="©2026 Inlink Vietnam JSC. All rights reserved."
                maxLength={500}
              />
            </Field>
            <p className="text-[11px] text-slate-400">
              Hiển thị full-width dưới Footer 1/2. Superadmin tuỳ biến toàn bộ chuỗi.
            </p>
          </CmsCollapsiblePanel>
        </div>
      )}
    </AdminShell>
  );
}
