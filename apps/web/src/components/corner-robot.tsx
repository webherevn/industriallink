'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CopilotRobot } from '@/components/copilot-robot';
import { tokenStore } from '@/lib/api';
import { fetchMySupportChat, fetchSupportPrompts, sendSupportChat } from '@/lib/support-chat';

const ROTATE_MS = 3500;

function shortName(displayName?: string | null): string {
  const token = displayName?.trim().split(/\s+/).filter(Boolean).slice(-1)[0];
  return token || 'bạn';
}

const FALLBACK_PROMPTS = [
  'Hi, {ten}, cần tôi giúp gì cho bạn?',
  'Bạn đang khó khăn phần nào? Hãy chatbox để Inlink hướng dẫn?',
  'Inlink vẫn đang trong giai đoạn trải nghiệm và thử nghiệm chắc chắn sẽ có một vài lỗi/thiếu sót, mong bạn thông cảm và gửi góp ý cho đội ngũ nhé.',
];

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Robot trợ lý góc dưới phải. Bấm robot hoặc câu chào để gửi góp ý về CRM. */
export function CornerRobot({ name }: { name?: string | null }) {
  const who = shortName(name);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [hintHidden, setHintHidden] = useState(false);
  const [draft, setDraft] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const prompts = useQuery({
    queryKey: ['support-chat-prompts'],
    queryFn: fetchSupportPrompts,
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });
  const stored = prompts.isSuccess ? prompts.data.map((line) => line.body) : FALLBACK_PROMPTS;
  const lines = stored.map((line) => line.split('{ten}').join(who));

  useEffect(() => {
    setHasToken(Boolean(tokenStore.get()));
    setHintHidden(window.sessionStorage.getItem('inlink-robot-hint-hidden') === '1');
  }, []);

  useEffect(() => {
    if (open || hintHidden || lines.length === 0) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [lines.length, open, hintHidden]);

  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const publish = () => {
      window.dispatchEvent(new CustomEvent('inlink-support-dock', { detail: { height: el.offsetHeight } }));
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.dispatchEvent(new CustomEvent('inlink-support-dock', { detail: { height: 0 } }));
    };
  }, []);

  const peek = useQuery({
    queryKey: ['support-chat', 'peek'],
    queryFn: () => fetchMySupportChat(false),
    enabled: hasToken && !open,
    retry: false,
    refetchInterval: 20_000,
  });

  const thread = useQuery({
    queryKey: ['support-chat', 'open'],
    queryFn: () => fetchMySupportChat(true),
    enabled: hasToken && open,
    retry: false,
    refetchInterval: open ? 4_000 : false,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendSupportChat(body),
    onSuccess: async () => {
      setDraft('');
      await qc.invalidateQueries({ queryKey: ['support-chat'] });
    },
  });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.data, open]);

  const unread = open ? 0 : (peek.data?.unread ?? 0);
  const messages = thread.data?.messages ?? [];

  return (
    <div
      ref={dock}
      className="pointer-events-none fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end"
    >
      {open && (
        <div className="chat-pop pointer-events-auto mb-3 flex h-[min(68vh,440px)] w-[min(100vw-2rem,340px)] flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_22px_50px_-16px_rgba(7,35,72,0.55)] ring-1 ring-[#072348]/10">
          <div className="flex items-center gap-2 bg-[#072348] px-3 py-2.5 text-white">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Chat với inlink</p>
              <p className="text-[11px] text-white/70">Câu hỏi và góp ý gửi về CRM</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-white/10"
              aria-label="Đóng chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#F4F7FB] px-3 py-3">
            {thread.isLoading && <p className="text-center text-xs text-slate-400">Đang tải…</p>}
            {messages.map((message) => (
              <div key={message.id} className={clsx('flex', message.mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={clsx(
                    'max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm',
                    message.mine
                      ? 'rounded-br-md bg-[#072348] text-white'
                      : 'rounded-bl-md bg-white text-slate-800',
                  )}
                >
                  {!message.mine && (
                    <p className="mb-0.5 text-[10px] font-semibold text-[#E8872A]">inlink</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={clsx('mt-1 text-[10px]', message.mine ? 'text-white/60' : 'text-slate-400')}>
                    {formatClock(message.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {!thread.isLoading && messages.length === 0 && (
              <p className="px-2 text-center text-xs leading-relaxed text-slate-400">
                Viết câu hỏi hoặc góp ý. Đội ngũ inlink sẽ trả lời tại đây.
              </p>
            )}
          </div>
          <form
            className="flex items-center gap-2 border-t border-slate-100 bg-white px-2.5 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text || send.isPending) return;
              send.mutate(text);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder="Nhập câu hỏi hoặc góp ý…"
              className="h-9 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#072348]/30 focus:bg-white"
            />
            <button
              type="submit"
              disabled={send.isPending || draft.trim().length === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8872A] text-white transition hover:brightness-105 disabled:opacity-50"
              aria-label="Gửi"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          {send.isError && (
            <p className="px-3 pb-2 text-[11px] text-rose-600">Chưa gửi được. Thử lại sau.</p>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {!open && !hintHidden && lines.length > 0 && (
          <div className="pointer-events-auto relative mb-10 max-w-[240px]">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="cursor-pointer rounded-2xl rounded-br-md border border-[#d5deee] bg-white px-3.5 py-2.5 pr-7 text-left text-[13px] leading-snug text-slate-700 shadow-[0_14px_32px_rgba(7,35,72,0.28),0_2px_8px_rgba(7,35,72,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(7,35,72,0.34)]"
            >
              <span key={index} className="corner-robot-bubble block">
                {lines[index % lines.length]}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setHintHidden(true);
                window.sessionStorage.setItem('inlink-robot-hint-hidden', '1');
              }}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-brand-700"
              aria-label="Ẩn lời chào"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="corner-robot-float pointer-events-auto relative w-[92px] shrink-0 cursor-pointer sm:w-[112px]"
          aria-label={open ? 'Đóng chat inlink' : 'Mở chat inlink'}
        >
          <CopilotRobot />
          {!open && unread > 0 && (
            <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
