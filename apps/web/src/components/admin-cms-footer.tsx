'use client';

import type { CmsFooterBlock, CmsFooterSettingsView } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { CmsRichEditor } from '@/components/cms-rich-editor';
import { Button, Card, Field, Input } from '@/components/ui';
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
    <CmsCollapsiblePanel title={title} defaultOpen={defaultOpen}>
      <p className="text-xs text-slate-500">{hint}</p>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
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
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="cms-page-title">Chân trang</h1>
          <p className="cms-page-subtitle">
            Footer 1 & Footer 2 (mỗi cái 4 cột rich text) · tick ẩn/hiện · copyright tuỳ biến.
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5"
          disabled={saveMutation.isPending || isLoading}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Đang lưu…' : 'Lưu chân trang'}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã lưu cấu hình chân trang.
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="mt-5 space-y-4">
          <Card className="flex items-start gap-3 border-brand-100 bg-brand-50/40">
            <Columns3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div className="text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Cách hoạt động</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                <li>Tắt cả khối Footer bằng checkbox «Hiển thị».</li>
                <li>Cột để trống HTML sẽ tự ẩn — grid co theo số cột còn nội dung.</li>
                <li>Hàng copyright luôn nằm dưới cùng (absolute bottom bar).</li>
              </ul>
            </div>
          </Card>

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

          <CmsCollapsiblePanel title="Copyright (hàng dưới cùng)" defaultOpen>
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
