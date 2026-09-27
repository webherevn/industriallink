'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, BookOpen, ExternalLink, Info, Lightbulb, Search, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { UserRole } from '@industriallink/contracts';
import {
  ADMIN_DOC_GROUPS,
  type DocBlock,
  type DocGroup,
  type DocSection,
  type DocTone,
} from '@/lib/admin-docs-content';
import { fetchMe } from '@/lib/auth';

const TONE_PILL: Record<DocTone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  navy: 'bg-[#072348] text-white ring-[#072348]',
};

const CALLOUT: Record<'info' | 'warn' | 'tip', { box: string; icon: typeof Info; iconClass: string }> = {
  info: { box: 'border-sky-200 bg-sky-50/70 text-sky-950', icon: Info, iconClass: 'text-sky-600' },
  warn: { box: 'border-amber-200 bg-amber-50/80 text-amber-950', icon: TriangleAlert, iconClass: 'text-amber-600' },
  tip: { box: 'border-emerald-200 bg-emerald-50/70 text-emerald-950', icon: Lightbulb, iconClass: 'text-emerald-600' },
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function blockText(block: DocBlock): string {
  switch (block.type) {
    case 'p':
      return block.text;
    case 'list':
      return [block.title ?? '', ...block.items].join(' ');
    case 'steps':
      return [block.title ?? '', ...block.items.flatMap((i) => [i.title, i.text, i.actor ?? ''])].join(' ');
    case 'statuses':
      return [block.title ?? '', ...block.items.flatMap((i) => [i.label, i.code ?? '', i.text])].join(' ');
    case 'callout':
      return `${block.title ?? ''} ${block.text}`;
    case 'table':
      return [block.title ?? '', ...block.head, ...block.rows.flat()].join(' ');
  }
}

function sectionMatches(section: DocSection, q: string): boolean {
  if (!q) return true;
  const hay = normalize(
    [section.title, section.summary, ...(section.keywords ?? []), ...section.blocks.map(blockText)].join(' '),
  );
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'p':
      return <p className="text-[13.5px] leading-relaxed text-slate-600">{block.text}</p>;

    case 'list':
      return (
        <div>
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <ul className="space-y-1.5">
            {block.items.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed text-slate-600">
                <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case 'steps':
      return (
        <div>
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-gradient-to-b before:from-accent-300 before:to-slate-200">
            {block.items.map((step, idx) => (
              <li key={`${idx}-${step.title}`} className="relative flex gap-3.5">
                <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#072348] text-[11px] font-bold text-white ring-4 ring-white">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-[#f8fafc] px-3.5 py-2.5 ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#072348]">{step.title}</p>
                    {step.actor ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700 ring-1 ring-accent-200">
                        {step.actor}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'statuses':
      return (
        <div>
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-100">
            {block.items.map((item, idx) => (
              <div
                key={`${item.label}-${item.code ?? idx}`}
                className={clsx(
                  'grid gap-2 px-3.5 py-2.5 sm:grid-cols-[210px_1fr] sm:gap-4',
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#fbfcfe]',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
                      TONE_PILL[item.tone],
                    )}
                  >
                    {item.label}
                  </span>
                  {item.code ? (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">{item.code}</code>
                  ) : null}
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'callout': {
      const c = CALLOUT[block.tone];
      const Icon = c.icon;
      return (
        <div className={clsx('flex gap-3 rounded-xl border px-3.5 py-3', c.box)}>
          <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', c.iconClass)} />
          <div className="min-w-0 text-[13px] leading-relaxed">
            {block.title ? <p className="font-semibold">{block.title}</p> : null}
            <p className={block.title ? 'mt-0.5 opacity-90' : ''}>{block.text}</p>
          </div>
        </div>
      );
    }

    case 'table':
      return (
        <div>
          {block.title ? <BlockTitle>{block.title}</BlockTitle> : null}
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
            <table className="w-full min-w-[520px] text-left text-[12.5px]">
              <thead className="bg-[#072348] text-white">
                <tr>
                  {block.head.map((h) => (
                    <th key={h} className="px-3.5 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className={r % 2 === 0 ? 'bg-white' : 'bg-[#fbfcfe]'}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className={clsx(
                          'border-t border-slate-100 px-3.5 py-2 align-top leading-relaxed',
                          c === 0 ? 'font-semibold text-[#072348]' : 'text-slate-600',
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{children}</p>
  );
}

function SectionCard({ section }: { section: DocSection }) {
  const Icon = section.icon;
  return (
    <article id={section.id} className="admin-dash-card scroll-mt-24 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3E6] text-accent-600 ring-1 ring-[#FFD0A3]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#072348]">{section.title}</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{section.summary}</p>
          </div>
        </div>
        {section.href ? (
          <Link
            href={section.href}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]"
          >
            Mở trang <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </header>
      <div className="mt-4 space-y-4">
        {section.blocks.map((block, idx) => (
          <Block key={idx} block={block} />
        ))}
      </div>
    </article>
  );
}

export function AdminDocs() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const isSuper = me?.role === UserRole.SuperAdmin;
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const q = normalize(query.trim());

  const groups: DocGroup[] = useMemo(
    () =>
      ADMIN_DOC_GROUPS.map((g) => ({
        ...g,
        sections: g.sections.filter((s) => (isSuper || !s.superAdminOnly) && sectionMatches(s, q)),
      })).filter((g) => g.sections.length > 0),
    [isSuper, q],
  );

  const total = groups.reduce((n, g) => n + g.sections.length, 0);

  useEffect(() => {
    const els = groups.flatMap((g) => g.sections.map((s) => document.getElementById(s.id))).filter(Boolean);
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    els.forEach((el) => observer.observe(el as Element));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <div className="admin-dash space-y-6">
      <section className="admin-dash-hero admin-dash-rise p-6 sm:p-8">
        <span className="admin-dash-glow -right-10 -top-12 h-44 w-44 bg-accent-500/40" aria-hidden />
        <span className="admin-dash-glow -bottom-16 left-1/4 h-36 w-36 bg-sky-400/20" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-300">
              <BookOpen className="h-3.5 w-3.5" /> Documents
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[28px]">Tài liệu quản trị inlink</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Giải thích từng module Superadmin: nó làm gì, chạy theo cơ chế nào, các trạng thái có ý nghĩa gì và
              hệ thống tự động xử lý ra sao — mô tả đúng như code đang chạy thực tế.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15">
              <p className="text-xl font-bold tabular-nums">{ADMIN_DOC_GROUPS.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Nhóm</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15">
              <p className="text-xl font-bold tabular-nums">{total}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Chủ đề</p>
            </div>
          </div>
        </div>
        <div className="relative mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong tài liệu: xác minh, kiểm duyệt, trạng thái, indexing…"
            className="h-11 w-full rounded-xl border-0 bg-white pl-10 pr-3 text-sm text-slate-800 shadow-lg shadow-black/10 outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-accent-400"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-4 overflow-y-auto rounded-[1.15rem] bg-white p-3 ring-1 ring-slate-200/90">
            {groups.map((g) => (
              <div key={g.id}>
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className={clsx(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition-colors',
                          activeId === s.id
                            ? 'bg-[#FFF3E6] text-accent-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-[#072348]',
                        )}
                      >
                        <s.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        <span className="truncate">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-8">
          {groups.length === 0 ? (
            <p className="rounded-[1.15rem] border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Không tìm thấy nội dung khớp «{query}».
            </p>
          ) : null}
          {groups.map((g) => (
            <section key={g.id} className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#072348]">{g.title}</h2>
                  <div className="brand-accent-bar mt-1.5" />
                  <p className="mt-2 text-[13px] text-slate-500">{g.description}</p>
                </div>
              </div>
              {g.flow ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200/90">
                  {g.flow.map((step, idx) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <span className="rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-[12px] font-semibold text-[#072348]">
                        {step}
                      </span>
                      {idx < g.flow!.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-accent-500" /> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="space-y-4">
                {g.sections.map((s) => (
                  <SectionCard key={s.id} section={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
