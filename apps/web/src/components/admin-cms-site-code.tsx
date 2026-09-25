'use client';

import type {
  CmsSiteCodeSettingsView,
  UpsertCmsSiteCodeSettingsRequest,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsCollapsiblePanel } from '@/components/cms-collapsible-panel';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getCmsSiteCodeAdmin, saveCmsSiteCodeAdmin } from '@/lib/admin-cms';

const EMPTY: UpsertCmsSiteCodeSettingsRequest = {
  headerEnabled: true,
  headerCode: '',
  footerEnabled: true,
  footerCode: '',
};

function fromView(v: CmsSiteCodeSettingsView): UpsertCmsSiteCodeSettingsRequest {
  return {
    headerEnabled: v.headerEnabled,
    headerCode: v.headerCode ?? '',
    footerEnabled: v.footerEnabled,
    footerCode: v.footerCode ?? '',
  };
}

export function AdminSiteCodePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-site-code'],
    queryFn: getCmsSiteCodeAdmin,
  });
  const [form, setForm] = useState<UpsertCmsSiteCodeSettingsRequest>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(fromView(data));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveCmsSiteCodeAdmin(form),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-site-code'] });
      setForm(fromView(res));
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
          <h1 className="cms-page-title">Header & Footer code</h1>
          <p className="cms-page-subtitle">
            Chèn mã HTML/JS vào &lt;head&gt; và trước &lt;/body&gt; — giống Insert Headers and
            Footers (WP).
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5"
          disabled={saveMutation.isPending || isLoading}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Đang lưu…' : 'Lưu mã'}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Đã lưu Header & Footer code.
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="mt-5 mx-auto max-w-4xl space-y-4">
          <Card className="flex items-start gap-3 border-amber-100 bg-amber-50/50 p-4 text-sm text-amber-950">
            <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">Chỉ SuperAdmin · không chạy trên /admin</p>
              <p className="text-xs leading-relaxed text-amber-900/80">
                Dán nguyên snippet GA / GTM / Pixel (kèm thẻ script). Mã chỉ inject trên site công
                khai.
              </p>
            </div>
          </Card>

          <CmsCollapsiblePanel title="Scripts in Header" defaultOpen>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(form.headerEnabled)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, headerEnabled: e.target.checked }))
                }
              />
              Bật mã Header
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Chèn vào &lt;head&gt; — meta verification, CSS, script async.
            </p>
            <textarea
              value={form.headerCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, headerCode: e.target.value }))}
              spellCheck={false}
              disabled={!form.headerEnabled}
              className="cms-field-control mt-3 min-h-[220px] font-mono text-[12px] leading-relaxed disabled:opacity-50"
              placeholder={'<!-- Google tag (gtag.js) -->\n<script>...</script>'}
            />
          </CmsCollapsiblePanel>

          <CmsCollapsiblePanel title="Scripts in Footer" defaultOpen>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={Boolean(form.footerEnabled)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, footerEnabled: e.target.checked }))
                }
              />
              Bật mã Footer
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Chèn trước &lt;/body&gt; — chat widget, tracking không chặn LCP.
            </p>
            <textarea
              value={form.footerCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, footerCode: e.target.value }))}
              spellCheck={false}
              disabled={!form.footerEnabled}
              className="cms-field-control mt-3 min-h-[220px] font-mono text-[12px] leading-relaxed disabled:opacity-50"
              placeholder={'<script>\n  // footer scripts\n</script>'}
            />
          </CmsCollapsiblePanel>
        </div>
      )}
    </AdminShell>
  );
}
