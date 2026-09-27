'use client';

import type { CmsLinkSuggestion } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import { Check, Link2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLinkSuggestions } from '@/lib/admin-cms';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

const KIND_LABEL: Record<CmsLinkSuggestion['kind'], string> = {
  post: 'Bài viết',
  page: 'Trang',
  category: 'Danh mục',
};

export function CmsInternalLinkSuggestions({
  title,
  focusKeyword,
  excludeId,
  bodyHtml,
  onInsert,
}: {
  title: string;
  focusKeyword: string;
  excludeId?: string;
  bodyHtml: string;
  onInsert: (html: string) => void;
}) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const next = [title, focusKeyword].filter(Boolean).join(' ').trim();
    const timer = window.setTimeout(() => setQ(next), 400);
    return () => window.clearTimeout(timer);
  }, [title, focusKeyword]);

  const { data = [], isFetching } = useQuery({
    queryKey: ['cms-link-suggestions', q, excludeId ?? ''],
    queryFn: () => fetchLinkSuggestions(q, excludeId),
    enabled: q.trim().length >= 3,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-accent-600 ring-1 ring-[#FFD0A3]">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#072348]">Gợi ý link nội bộ</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Chèn một đoạn có link tới bài, trang hoặc danh mục gần với tiêu đề và từ khóa của bài này.
          </p>
        </div>
      </div>
      {q.trim().length < 3 ? (
        <p className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-slate-400">Nhập tiêu đề để xem gợi ý.</p>
      ) : isFetching && data.length === 0 ? (
        <p className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-slate-400">Đang tìm…</p>
      ) : data.length === 0 ? (
        <p className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs text-slate-400">Chưa có trang nào trùng từ khóa.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
          {data.map((item) => (
            <SuggestionRow key={`${item.kind}-${item.id}`} item={item} bodyHtml={bodyHtml} onInsert={onInsert} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionRow({
  item,
  bodyHtml,
  onInsert,
}: {
  item: CmsLinkSuggestion;
  bodyHtml: string;
  onInsert: (html: string) => void;
}) {
  const already = bodyHtml.includes(`href="${item.publicPath}"`) || bodyHtml.includes(`href='${item.publicPath}'`);
  return (
    <li className="admin-dash-row flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="rounded bg-[#f8fafc] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
            {KIND_LABEL[item.kind]}
          </span>
          <span className="truncate">{item.publicPath}</span>
        </p>
      </div>
      <button
        type="button"
        disabled={already}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-[#072348] px-2.5 text-xs font-semibold text-white transition hover:bg-[#0c3a72] disabled:bg-emerald-50 disabled:text-emerald-700"
        onClick={() => {
          const block = `<p><a href="${esc(item.publicPath)}">${esc(item.anchor)}</a></p>`;
          onInsert(bodyHtml.trim() ? `${bodyHtml}\n${block}` : block);
        }}
      >
        {already ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {already ? 'Đã có' : 'Chèn'}
      </button>
    </li>
  );
}
