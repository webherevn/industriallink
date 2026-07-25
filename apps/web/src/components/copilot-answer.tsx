'use client';

import clsx from 'clsx';
import { Briefcase, Sparkles, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CopilotSource } from '@industriallink/contracts';

type Props = {
  answer: string;
  sources: CopilotSource[];
  searchHref: string;
  provider?: string;
};

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'h'; text: string };

/** Hiển thị câu trả lời Copilot theo hàng rõ ràng + hiệu ứng gõ. */
export function CopilotAnswer({ answer, sources, searchHref, provider }: Props) {
  const blocks = useMemo(() => parseAnswerBlocks(answer), [answer]);
  const flatText = useMemo(() => blocksToPlain(blocks), [blocks]);
  const [chars, setChars] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setChars(0);
    setDone(false);
    if (!flatText) {
      setDone(true);
      return;
    }
    let i = 0;
    const step = Math.max(2, Math.ceil(flatText.length / 60));
    const id = window.setInterval(() => {
      i = Math.min(flatText.length, i + step);
      setChars(i);
      if (i >= flatText.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [flatText]);

  const visibleBlocks = useMemo(
    () => (done ? blocks : sliceBlocks(blocks, chars)),
    [blocks, chars, done],
  );

  const pipeline = sources.find((s) => /pipeline|workspace/i.test(s.title));
  const jobs = sources.find((s) => /tin tuyển|job/i.test(s.title));
  const candidates = sources.find((s) => /ứng viên|candidate/i.test(s.title));
  const hasCandidateSuggestions = Boolean(candidates?.candidateIds?.length);

  return (
    <div className="copilot-answer-enter mt-4 space-y-3">
      <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-inner backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-200/90">
            {done ? 'Gợi ý từ AI' : 'AI đang phân tích'}
          </p>
          {provider && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-white/70">
              {provider}
            </span>
          )}
        </div>

        <div className="space-y-2.5 text-[13px] leading-relaxed text-white/95">
          {visibleBlocks.map((block, idx) => (
            <AnswerBlock key={`${block.type}-${idx}`} block={block} />
          ))}
          {!done && (
            <span className="inline-block h-3.5 w-0.5 animate-pulse bg-cyan-200 align-middle" />
          )}
        </div>

        {done && (pipeline || jobs || candidates) && (
          <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
            {pipeline && <SourceCard icon="pipeline" title="Pipeline" snippet={pipeline.snippet} />}
            {jobs && <SourceCard icon="jobs" title="Tin tuyển dụng" snippet={jobs.snippet} />}
            {candidates && (
              <SourceCard
                icon="candidates"
                title={candidates.title.replace(/\s*\(.*\)$/, '') || 'Ứng viên phù hợp nhất'}
                snippet={candidates.snippet}
                candidateIds={candidates.candidateIds}
                className="sm:col-span-2"
                asList
              />
            )}
          </div>
        )}

        {done && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Link
              href={searchHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-3.5 py-1.5 text-[12px] font-semibold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Tìm ứng viên AI
            </Link>
            {hasCandidateSuggestions && candidates?.candidateIds?.[0] && (
              <Link
                href={`/candidates/${candidates.candidateIds[0]}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3.5 py-1.5 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-400/25"
              >
                <UserRound className="h-3.5 w-3.5" />
                Xem hồ sơ ứng viên
              </Link>
            )}
            <Link
              href="/recruiter/inbox"
              className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90 transition hover:bg-white/20"
            >
              Mở hộp thư
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerBlock({ block }: { block: Block }) {
  if (block.type === 'h') {
    return (
      <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-cyan-200/90">
        {renderInline(block.text)}
      </p>
    );
  }
  if (block.type === 'p') {
    return <p className="text-white/95">{renderInline(block.text)}</p>;
  }
  if (block.type === 'ul') {
    return (
      <ul className="space-y-1.5 border-l-2 border-cyan-400/30 pl-3">
        {block.items.map((item, i) => (
          <li key={i} className="relative text-white/90">
            <span className="absolute -left-[15px] top-2 h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-cyan-200/80">
      {block.items.map((item, i) => (
        <li key={i} className="pl-1 text-white/90">
          {renderInline(item)}
        </li>
      ))}
    </ol>
  );
}

function SourceCard({
  icon,
  title,
  snippet,
  candidateIds,
  className,
  asList,
}: {
  icon: 'pipeline' | 'jobs' | 'candidates';
  title: string;
  snippet: string;
  candidateIds?: string[];
  className?: string;
  asList?: boolean;
}) {
  const Icon = icon === 'pipeline' ? Sparkles : icon === 'jobs' ? Briefcase : Users;
  const lines = snippet
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div
      className={clsx(
        'rounded-xl border border-white/10 bg-[#0B1B4D]/45 px-3 py-2.5',
        className,
      )}
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {asList ? (
        <ul className="space-y-1.5">
          {lines.map((line, idx) => {
            const match = line.match(/phù hợp\s+(\d+)%/i);
            const pct = match?.[1];
            const name = line.split('·')[0]?.trim() ?? line;
            const rest = line.includes('·')
              ? line.slice(line.indexOf('·') + 1).replace(/phù hợp\s+\d+%\s*—?\s*/i, '').trim()
              : '';
            const href = candidateIds?.[idx] ? `/candidates/${candidateIds[idx]}` : null;
            const body = (
              <>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white">{name}</p>
                  {rest && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/55">
                      {rest}
                    </p>
                  )}
                </div>
                {pct && (
                  <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {pct}%
                  </span>
                )}
              </>
            );
            return (
              <li key={line}>
                {href ? (
                  <Link
                    href={href}
                    className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5 transition hover:bg-white/10"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line} className="text-[11px] leading-snug text-white/75">
              {renderInline(line)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Parse markdown nhẹ → block theo hàng (p / list / heading). */
function parseAnswerBlocks(raw: string): Block[] {
  const text = raw
    .replace(/\(Mock AI[^)]*\)/gi, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'h', text: heading[1].trim() });
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Gộp paragraph; tách câu dài thành hàng nếu có ":" rồi bullet-like đoạn
    const paraParts: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+[.)]\s+/.test(lines[i].trim())
    ) {
      paraParts.push(lines[i].trim());
      i += 1;
    }
    const para = paraParts.join(' ').replace(/\s+/g, ' ').trim();
    for (const chunk of splitReadableRows(para)) {
      blocks.push({ type: 'p', text: chunk });
    }
  }

  return blocks;
}

/** Tách đoạn dài thành hàng ngắn hơn theo dấu câu / gạch đầu dòng ẩn. */
function splitReadableRows(para: string): string[] {
  // "A. B. C." hoặc câu kết thúc bằng . ! ? rồi xuống hàng
  const bySentence = para
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ0-9"«])|(?<=:)\s+(?=[-*•])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (bySentence.length >= 2) return bySentence;

  // Tách theo " - " dạng gạch giữa câu
  if (para.includes(' - ') && para.length > 120) {
    return para
      .split(/\s+-\s+/)
      .map((s, idx) => (idx === 0 ? s : `• ${s}`))
      .filter(Boolean);
  }

  return [para];
}

function blocksToPlain(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'p' || b.type === 'h') return b.text;
      return b.items.join(' ');
    })
    .join(' ');
}

function sliceBlocks(blocks: Block[], charBudget: number): Block[] {
  let left = charBudget;
  const out: Block[] = [];
  for (const b of blocks) {
    if (left <= 0) break;
    if (b.type === 'p' || b.type === 'h') {
      const slice = b.text.slice(0, left);
      out.push({ ...b, text: slice });
      left -= slice.length;
      continue;
    }
    const items: string[] = [];
    for (const item of b.items) {
      if (left <= 0) break;
      const slice = item.slice(0, left);
      items.push(slice);
      left -= slice.length;
    }
    if (items.length) out.push({ ...b, items });
  }
  return out;
}

/** Render **bold**, *italic*, `code` inline. */
function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key++} className="italic text-white/90">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-cyan-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : nodes;
}
