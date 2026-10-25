'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ConnectionChatThread } from '@industriallink/contracts';
import { tokenStore } from '@/lib/api';
import {
  listConnectionChats,
  listConnectionMessages,
  sendConnectionMessage,
} from '@/lib/candidate';

/** Khung chat góc dưới phải — chỉ hiện khi đã có kết nối được chấp nhận. */
export function ConnectionChat() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasToken(Boolean(tokenStore.get()));
  }, []);

  const threads = useQuery({
    queryKey: ['connection-chats'],
    queryFn: listConnectionChats,
    enabled: hasToken,
    retry: false,
    refetchInterval: open ? 8_000 : 25_000,
  });

  const messages = useQuery({
    queryKey: ['connection-messages', activeId],
    queryFn: () => listConnectionMessages(activeId!),
    enabled: hasToken && open && Boolean(activeId),
    retry: false,
    refetchInterval: open && activeId ? 4_000 : false,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendConnectionMessage(activeId!, body),
    onSuccess: async () => {
      setDraft('');
      await qc.invalidateQueries({ queryKey: ['connection-messages', activeId] });
      await qc.invalidateQueries({ queryKey: ['connection-chats'] });
    },
  });

  useEffect(() => {
    function onOpen(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      if (!id) return;
      setActiveId(id);
      setOpen(true);
      void qc.invalidateQueries({ queryKey: ['connection-chats'] });
    }
    window.addEventListener('inlink-open-chat', onOpen);
    return () => window.removeEventListener('inlink-open-chat', onOpen);
  }, [qc]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.data, activeId, open]);

  const list = threads.data ?? [];
  if (!hasToken || (list.length === 0 && !open)) return null;

  const active = list.find((t) => t.connectionId === activeId) ?? null;
  const unread = list.reduce((sum, t) => sum + t.unread, 0);

  function pick(thread: ConnectionChatThread) {
    setActiveId(thread.connectionId);
    setDraft('');
  }

  return (
    <div className="fixed bottom-36 right-4 z-40 flex flex-col items-end">
      {open && (
        <div className="chat-pop mb-3 flex h-[min(70vh,480px)] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-20px_rgba(7,35,72,0.45)]">
          <div className="flex items-center gap-2 bg-[#072348] px-3 py-2.5 text-white">
            {activeId ? (
              <button
                type="button"
                onClick={() => setActiveId(null)}
                className="rounded-full p-1 hover:bg-white/10"
                aria-label="Danh sách hội thoại"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <MessageCircle className="h-4 w-4 text-amber-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {active ? active.peerName : 'Tin nhắn'}
              </p>
              <p className="truncate text-[11px] text-white/70">
                {active?.peerHint ?? 'Kết nối đã chấp nhận'}
              </p>
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

          {!activeId && (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {list.map((thread) => (
                <li key={thread.connectionId}>
                  <button
                    type="button"
                    onClick={() => pick(thread)}
                    className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                      {thread.peerName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {thread.peerName}
                        </span>
                        {thread.unread > 0 && (
                          <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                            {thread.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {thread.lastBody ?? thread.peerHint ?? 'Bắt đầu trò chuyện'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {activeId && (
            <>
              <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#F4F7FB] px-3 py-3">
                {messages.isLoading && (
                  <p className="text-center text-xs text-slate-400">Đang tải tin nhắn…</p>
                )}
                {(messages.data ?? []).map((m) => (
                  <div key={m.id} className={clsx('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm',
                        m.mine
                          ? 'rounded-br-md bg-[#072348] text-white'
                          : 'rounded-bl-md bg-white text-slate-800',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={clsx('mt-1 text-[10px]', m.mine ? 'text-white/60' : 'text-slate-400')}>
                        {formatClock(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {!messages.isLoading && (messages.data ?? []).length === 0 && (
                  <p className="text-center text-xs text-slate-400">Hãy gửi lời chào đầu tiên.</p>
                )}
              </div>
              <form
                className="flex items-center gap-2 border-t border-slate-100 bg-white px-2.5 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = draft.trim();
                  if (!text || send.isPending) return;
                  send.mutate(text);
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  placeholder="Nhập tin nhắn…"
                  className="h-9 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-300 focus:bg-white"
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
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#072348] text-white shadow-lg shadow-[#072348]/30 transition hover:scale-105"
        aria-label={open ? 'Đóng tin nhắn' : 'Mở tin nhắn'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
