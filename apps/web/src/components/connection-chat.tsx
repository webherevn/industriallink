'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Loader2, MessageCircle, Search, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnectionChatThread } from '@industriallink/contracts';
import { tokenStore } from '@/lib/api';
import {
  listConnectionChats,
  listConnectionMessages,
  sendConnectionMessage,
} from '@/lib/candidate';

/** Khung chat kết nối đã chấp nhận. `embedded` dùng cho trang Chat trên sidebar. */
export function ConnectionChat({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<'all' | 'unread'>('all');
  const [hasToken, setHasToken] = useState(false);
  const [dockHeight, setDockHeight] = useState(128);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasToken(Boolean(tokenStore.get()));
  }, []);

  useEffect(() => {
    function onDock(event: Event) {
      const height = (event as CustomEvent<{ height?: number }>).detail?.height;
      if (typeof height === 'number') setDockHeight(height);
    }
    window.addEventListener('inlink-support-dock', onDock);
    return () => window.removeEventListener('inlink-support-dock', onDock);
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
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((thread) => {
      if (folder === 'unread' && thread.unread <= 0) return false;
      if (!q) return true;
      const hay = `${thread.peerName} ${thread.peerHint ?? ''} ${thread.lastBody ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [list, query, folder]);
  const onChatPage = pathname === '/chat' || pathname.startsWith('/recruiter/chat');
  if (!embedded && onChatPage) return null;
  if (!embedded && (!hasToken || (list.length === 0 && !open))) return null;
  if (embedded && !hasToken) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
        Đăng nhập để xem các cuộc trao đổi đã kết nối.
      </p>
    );
  }

  const active = list.find((t) => t.connectionId === activeId) ?? null;
  const unread = list.reduce((sum, t) => sum + t.unread, 0);

  function pick(thread: ConnectionChatThread) {
    setActiveId(thread.connectionId);
    setDraft('');
  }

  const panelOpen = embedded || open;

  return (
    <div
      className={embedded ? 'min-w-0' : 'fixed right-4 z-40 flex flex-col items-end'}
      style={embedded ? undefined : { bottom: dockHeight + 20 }}
    >
      {panelOpen && (
        <div
          className={clsx(
            'flex overflow-hidden rounded-2xl border border-slate-200 bg-white',
            embedded
              ? 'h-[min(720px,calc(100vh-11rem))] w-full shadow-sm'
              : 'chat-pop mb-3 w-[min(1080px,calc(100vw-2rem))] shadow-[0_22px_60px_-24px_rgba(7,35,72,0.55)]',
          )}
          style={
            embedded ? undefined : { height: `min(640px, calc(100vh - ${dockHeight + 96}px))` }
          }
        >
          <aside
            className={clsx(
              'w-full shrink-0 flex-col border-r border-slate-100 bg-white lg:flex lg:w-[300px]',
              activeId ? 'hidden lg:flex' : 'flex',
            )}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
              <MessageCircle className="h-4 w-4 text-accent-500" />
              <p className="min-w-0 flex-1 text-sm font-semibold text-brand-700">Tin nhắn</p>
              {!embedded && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700 lg:hidden"
                  aria-label="Đóng chat"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="px-3 pt-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm hội thoại"
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="mt-2 flex gap-1.5">
                {(
                  [
                    ['all', 'Tất cả'],
                    ['unread', 'Chưa đọc'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFolder(id)}
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      folder === id
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
              {shown.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-slate-400">Không có hội thoại.</li>
              )}
              {shown.map((thread) => {
                const selected = thread.connectionId === activeId;
                return (
                  <li key={thread.connectionId}>
                    <button
                      type="button"
                      onClick={() => pick(thread)}
                      className={clsx(
                        'flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left',
                        selected ? 'bg-accent-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <PeerMark name={thread.peerName} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-brand-700">
                            {thread.peerName}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {thread.lastAt ? formatClock(thread.lastAt) : ''}
                          </span>
                        </span>
                        {thread.peerHint && (
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {thread.peerHint}
                          </span>
                        )}
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500">
                            {thread.lastBody ?? 'Bắt đầu trò chuyện'}
                          </span>
                          {thread.unread > 0 && (
                            <span className="rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">
                              {thread.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section
            className={clsx(
              'min-w-0 flex-1 flex-col bg-[#F4F7FB]',
              activeId ? 'flex' : 'hidden lg:flex',
            )}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
              {activeId && (
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="rounded-full p-1 text-brand-700 hover:bg-slate-100 lg:hidden"
                  aria-label="Danh sách hội thoại"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-700">
                  {active ? active.peerName : 'Chọn hội thoại'}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {active?.peerHint ?? 'Kết nối đã chấp nhận'}
                </p>
              </div>
              {!embedded && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700"
                  aria-label="Đóng chat"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {!activeId && (
                <p className="pt-16 text-center text-sm text-slate-400">
                  Chọn một người ở danh sách để trao đổi.
                </p>
              )}
              {activeId && messages.isLoading && (
                <p className="text-center text-xs text-slate-400">Đang tải tin nhắn…</p>
              )}
              {activeId &&
                (messages.data ?? []).map((m) => (
                  <div key={m.id} className={clsx('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={clsx(
                        'max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm',
                        m.mine
                          ? 'rounded-br-md bg-[#072348] text-white'
                          : 'rounded-bl-md border border-slate-200 bg-white text-slate-800',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={clsx('mt-1 text-[10px]', m.mine ? 'text-white/60' : 'text-slate-400')}>
                        {formatClock(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              {activeId && !messages.isLoading && (messages.data ?? []).length === 0 && (
                <p className="text-center text-xs text-slate-400">Hãy gửi lời chào đầu tiên.</p>
              )}
            </div>
            <form
              className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!activeId || !text || send.isPending) return;
                send.mutate(text);
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                disabled={!activeId}
                placeholder={activeId ? 'Nhập tin nhắn…' : 'Chọn hội thoại để nhắn'}
                className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-brand-300 focus:bg-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!activeId || send.isPending || draft.trim().length === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8872A] text-white transition hover:brightness-105 disabled:opacity-50"
                aria-label="Gửi"
              >
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </section>

          <aside className="hidden w-[240px] shrink-0 flex-col border-l border-slate-100 bg-white xl:flex">
            {active ? (
              <div className="px-4 py-5">
                <PeerMark name={active.peerName} large />
                <p className="mt-3 text-sm font-semibold text-brand-700">{active.peerName}</p>
                <p className="mt-0.5 text-xs text-slate-500">{active.peerHint ?? 'Đối tác kết nối'}</p>
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-700">
                  Kết nối đã được chấp nhận. Trao đổi tiếp trong khung chat này.
                </p>
                {active.lastBody && (
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    Tin gần nhất: {active.lastBody}
                  </p>
                )}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                Hồ sơ hiện khi bạn mở một hội thoại.
              </p>
            )}
          </aside>
        </div>
      )}

      {!embedded && (
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
      )}
    </div>
  );
}

function PeerMark({ name, large }: { name: string; large?: boolean }) {
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white',
        large ? 'h-14 w-14 text-lg' : 'mt-0.5 h-9 w-9 text-xs',
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
