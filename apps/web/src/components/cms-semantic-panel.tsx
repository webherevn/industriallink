'use client';

import type { CmsFaqItem, CmsPageRatio, CmsSemanticAssist } from '@industriallink/contracts';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, KeyRound, Loader2, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { assistCmsSemantic } from '@/lib/admin-cms';

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function overviewBullets(html: string): string[] {
  const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => strip(match[1] || ''))
    .filter((text) => text.length >= 24)
    .slice(0, 4);
  if (items.length >= 2) return items;
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => strip(match[1] || ''))
    .filter((text) => text.length >= 40);
  const sentences = (paragraphs[0] || '')
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
  return (sentences.length > 0 ? sentences : paragraphs).slice(0, 3);
}

const COVERAGE_LABEL: Record<CmsSemanticAssist['coverage'], string> = {
  enough: 'Đã phủ đủ',
  partial: 'Phủ một phần',
  thin: 'Còn thiếu nhiều',
};

export function CmsSemanticPanel({
  title,
  focusKeyword,
  bodyHtml,
  livePath,
  faq,
  onAddFaq,
}: {
  title: string;
  focusKeyword: string;
  bodyHtml: string;
  /** Đường dẫn công khai đã xuất bản, để đo tỷ lệ chữ trên trang thật. */
  livePath?: string;
  faq: CmsFaqItem[];
  onAddFaq: (items: CmsFaqItem[]) => void;
}) {
  const bullets = useMemo(() => overviewBullets(bodyHtml), [bodyHtml]);
  const [result, setResult] = useState<CmsSemanticAssist | null>(null);
  const [added, setAdded] = useState(false);
  const analyze = useMutation({
    mutationFn: () => assistCmsSemantic({ title, focusKeyword, html: bodyHtml, publicPath: livePath }),
    onSuccess: (data) => {
      setResult(data);
      setAdded(false);
    },
  });
  const present = result?.entities.filter((entity) => entity.present) ?? [];
  const missing = result?.entities.filter((entity) => !entity.present) ?? [];

  const coveredPercent = result ? Math.round((result.coveredCount / Math.max(1, result.checklistTotal)) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-accent-600 ring-1 ring-[#FFD0A3]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-[13px] font-bold text-[#072348]">Gemini SEO · thực thể & tỷ lệ chữ</p>
            <Link
              href="/admin/ai-settings"
              className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 hover:text-[#072348]"
            >
              <KeyRound className="h-3 w-3" />
              Khóa riêng · Cấu hình AI
            </Link>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Gemini đọc nội dung đang soạn (chưa cần lưu), liệt kê thực thể đã có, chấm 10 mục thực thể B2B, và nhận xét tỷ lệ chữ trên HTML.
            {livePath ? ' Bài đã xuất bản nên đo thêm trang công khai, gồm cả script và style.' : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-[#f8fafc] p-3">
        <SectionLabel>Xem trước đoạn trích AI Overviews</SectionLabel>
        {bullets.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">Viết vài câu hoặc một danh sách trong bài để xem đoạn có thể được trích.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-slate-700 marker:text-[#E8872A]">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#072348] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0c3a72] disabled:opacity-40"
        disabled={analyze.isPending || title.trim().length < 3}
        onClick={() => analyze.mutate()}
      >
        {analyze.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {analyze.isPending ? 'Gemini đang quét…' : result ? 'Quét lại bằng Gemini SEO' : 'Quét bài bằng Gemini SEO'}
      </button>
      {analyze.isError ? (
        <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {analyze.error instanceof Error ? analyze.error.message : 'Không quét được.'}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {result.note ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{result.note}</p>
          ) : null}

          <section>
            <SectionLabel>Tỷ lệ chữ trên HTML</SectionLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <RatioBox
                label="Nội dung đang soạn"
                ratio={result.ratio}
                detail={`${result.textChars} chữ / ${result.htmlChars} ký tự HTML`}
                warn={result.ratioVerdict === 'warn'}
              />
              {result.page ? <PageRatioBox page={result.page} /> : null}
            </div>
            {result.ratioAdvice ? <Advice>{result.ratioAdvice}</Advice> : null}
          </section>

          {result.source === 'gemini' ? (
            <>
              <section>
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>Độ phủ thực thể B2B</SectionLabel>
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold ring-1',
                      result.coverage === 'enough'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : result.coverage === 'partial'
                          ? 'bg-amber-50 text-amber-800 ring-amber-100'
                          : 'bg-red-50 text-red-700 ring-red-100',
                    )}
                  >
                    {result.coveredCount}/{result.checklistTotal} · {COVERAGE_LABEL[result.coverage]}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={clsx(
                      'admin-dash-bar h-full rounded-full',
                      result.coverage === 'enough' ? 'bg-emerald-500' : result.coverage === 'partial' ? 'bg-[#E8872A]' : 'bg-red-500',
                    )}
                    style={{ width: `${coveredPercent}%` }}
                  />
                </div>
                {result.coverageAdvice ? <Advice>{result.coverageAdvice}</Advice> : null}
              </section>

              {present.length > 0 ? (
                <section>
                  <SectionLabel>Thực thể đã có trong bài · {present.length}</SectionLabel>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {present.map((entity) => (
                      <span
                        key={entity.name}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100"
                      >
                        {entity.name}
                        {entity.type ? <span className="font-medium text-emerald-600/80">· {entity.type}</span> : null}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {missing.length > 0 ? (
                <section>
                  <SectionLabel>Mục B2B còn thiếu · {missing.length}</SectionLabel>
                  <ul className="mt-2 space-y-2">
                    {missing.map((entity) => (
                      <li key={entity.name} className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
                        <p className="font-bold text-amber-900">{entity.name}</p>
                        {entity.hint ? <p className="mt-0.5 leading-relaxed text-slate-600">{entity.hint}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {result.suggestions.length > 0 ? (
                <section>
                  <SectionLabel>Gợi ý sửa bài</SectionLabel>
                  <ol className="mt-2 space-y-1.5">
                    {result.suggestions.map((item, index) => (
                      <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#072348] text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {result.faq.length > 0 ? (
                <section>
                  <SectionLabel>FAQ gợi ý</SectionLabel>
                  <ul className="mt-2 space-y-2">
                    {result.faq.map((item) => (
                      <li key={item.question} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[13px] font-semibold text-[#072348]">{item.question}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.answer}</p>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={added}
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#E8872A] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#D06F18] disabled:bg-emerald-50 disabled:text-emerald-700 disabled:shadow-none"
                    onClick={() => {
                      const seen = new Set(faq.map((item) => item.question.trim().toLowerCase()));
                      const next = result.faq.filter((item) => !seen.has(item.question.trim().toLowerCase()));
                      if (next.length > 0) onAddFaq([...faq, ...next]);
                      setAdded(true);
                    }}
                  >
                    {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {added ? 'Đã thêm vào FAQ Schema' : 'Thêm vào FAQ Schema'}
                  </button>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

function Advice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 rounded-lg border-l-[3px] border-[#E8872A] bg-[var(--brand-accent-soft)] px-3 py-2 text-xs leading-relaxed text-slate-700">
      {children}
    </p>
  );
}

function RatioBox({ label, ratio, detail, warn }: { label: string; ratio: number; detail: string; warn: boolean }) {
  return (
    <div className={clsx('rounded-lg px-3 py-2.5 ring-1', warn ? 'bg-red-50/70 ring-red-100' : 'bg-emerald-50/70 ring-emerald-100')}>
      <p className="truncate text-[11px] font-medium text-slate-500" title={label}>
        {label}
      </p>
      <p className={clsx('mt-0.5 text-xl font-bold tabular-nums', warn ? 'text-red-700' : 'text-emerald-700')}>{ratio}%</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function PageRatioBox({ page }: { page: CmsPageRatio }) {
  if (page.error) {
    return (
      <div className="rounded-lg bg-[#f8fafc] px-3 py-2.5 ring-1 ring-slate-100">
        <p className="truncate text-[11px] font-medium text-slate-500">Trang công khai {page.path}</p>
        <p className="mt-0.5 text-xs text-slate-600">{page.error}</p>
      </div>
    );
  }
  return (
    <RatioBox
      label={`Trang công khai ${page.path}`}
      ratio={page.ratio}
      detail={`${page.textChars} chữ · script+style ${page.codeShare}% HTML`}
      warn={page.verdict === 'warn'}
    />
  );
}
