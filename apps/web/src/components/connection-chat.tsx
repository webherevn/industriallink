'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ChevronLeft, MessageCircle, Minus, Search, Send, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ConnectionChatMessage, ConnectionChatThread } from '@industriallink/contracts';
import { tokenStore } from '@/lib/api';
import { apiPublicBase } from '@/lib/public-paths';
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
  const viewing = embedded || open;

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
    refetchInterval: viewing ? 8_000 : 25_000,
  });

  const messages = useQuery({
    queryKey: ['connection-messages', activeId],
    queryFn: () => listConnectionMessages(activeId!),
    enabled: hasToken && viewing && Boolean(activeId),
    retry: false,
    refetchInterval: viewing && activeId ? 4_000 : false,
  });

  const send = useMutation({
    mutationFn: (input: { connectionId: string; body: string }) =>
      sendConnectionMessage(input.connectionId, input.body),
  });

  function publish(text: string) {
    const id = activeId;
    if (!id || !text) return;
    const tempId = `pending-${Date.now()}`;
    const temp: ConnectionChatMessage = {
      id: tempId,
      connectionId: id,
      body: text,
      mine: true,
      createdAt: new Date().toISOString(),
    };
    setDraft('');
    qc.setQueryData<ConnectionChatMessage[]>(['connection-messages', id], (current) => [
      ...(current ?? []),
      temp,
    ]);
    send.mutate(
      { connectionId: id, body: text },
      {
        onSuccess: (saved) => {
          qc.setQueryData<ConnectionChatMessage[]>(['connection-messages', id], (current) => {
            const items = current ?? [];
            if (items.some((item) => item.id === tempId)) {
              return items.map((item) => (item.id === tempId ? saved : item));
            }
            if (items.some((item) => item.id === saved.id)) return items;
            return [...items, saved];
          });
          void qc.invalidateQueries({ queryKey: ['connection-chats'] });
        },
        onError: () => {
          setDraft(text);
          qc.setQueryData<ConnectionChatMessage[]>(['connection-messages', id], (current) =>
            (current ?? []).filter((item) => item.id !== tempId),
          );
        },
      },
    );
  }

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
      const profile = thread.profile;
      const profileText = profile
        ? `${profile.headline ?? ''} ${profile.summary ?? ''} ${(profile.facts ?? []).map((fact) => fact.value).join(' ')} ${(profile.tags ?? []).join(' ')}`
        : '';
      const hay = `${thread.peerName} ${thread.peerHint ?? ''} ${thread.lastBody ?? ''} ${profileText}`.toLowerCase();
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

  if (!embedded) {
    return (
      <MessengerDock
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        threads={list}
        active={active}
        onPick={pick}
        onBack={() => setActiveId(null)}
        unread={unread}
        messages={messages.data ?? []}
        messagesLoading={Boolean(activeId) && messages.isLoading}
        draft={draft}
        onDraft={setDraft}
        onSend={() => publish(draft.trim())}
        sendError={send.isError}
        scroller={scroller}
        dockHeight={dockHeight}
      />
    );
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
              'min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white lg:flex lg:w-[300px]',
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
              'min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#F4F7FB]',
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
                  {active?.profile?.headline ?? active?.peerHint ?? 'Kết nối đã chấp nhận'}
                </p>
              </div>
              {active?.profile?.path && (
                <Link
                  href={active.profile.path}
                  className="shrink-0 rounded-full border border-brand-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 xl:hidden"
                >
                  Xem hồ sơ
                </Link>
              )}
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
            <div ref={scroller} className="min-h-0 flex-1 basis-0 space-y-2 overflow-y-auto px-3 py-3">
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
                publish(draft.trim());
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
                disabled={!activeId || draft.trim().length === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8872A] text-white transition hover:brightness-105 disabled:opacity-50"
                aria-label="Gửi"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>

          <aside className="hidden min-h-0 w-[268px] shrink-0 flex-col overflow-hidden border-l border-slate-100 bg-white xl:flex">
            {active ? (
              <ProfilePane thread={active} />
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

function MessengerDock({
  open,
  onOpen,
  onClose,
  threads,
  active,
  onPick,
  onBack,
  unread,
  messages,
  messagesLoading,
  draft,
  onDraft,
  onSend,
  sendError,
  scroller,
  dockHeight,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  threads: ConnectionChatThread[];
  active: ConnectionChatThread | null;
  onPick: (thread: ConnectionChatThread) => void;
  onBack: () => void;
  unread: number;
  messages: ConnectionChatMessage[];
  messagesLoading: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  sendError: boolean;
  scroller: RefObject<HTMLDivElement | null>;
  dockHeight: number;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const hay = `${thread.peerName} ${thread.peerHint ?? ''} ${thread.lastBody ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [threads, query]);

  return (
    <div
      className="pointer-events-none fixed right-4 z-40 flex flex-col items-end"
      style={{ bottom: dockHeight + 36 }}
    >
      {open && (
        <div
          className="chat-pop pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_42px_rgba(7,35,72,0.28)]"
          style={{ height: `min(520px, calc(100vh - ${dockHeight + 88}px))` }}
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            {active ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Danh sách hội thoại"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
            )}
            {active ? (
              <DockAvatar name={active.peerName} companyId={active.profile?.logoCompanyId} />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {active ? active.peerName : 'Tin nhắn'}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {active ? (active.profile?.headline ?? active.peerHint ?? 'Đã kết nối') : 'Kết nối đã chấp nhận'}
              </p>
            </div>
            {active?.profile?.path && (
              <Link href={active.profile.path} className="shrink-0 text-[11px] font-semibold text-brand-700 hover:underline">
                Hồ sơ
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Thu nhỏ"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {active ? (
            <>
              <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#F4F7FB] px-3 py-3">
                {messagesLoading && <p className="text-center text-xs text-slate-400">Đang tải tin nhắn…</p>}
                {messages.map((message, index) => {
                  const prev = messages[index - 1];
                  const showStamp = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
                  return (
                    <div key={message.id}>
                      {showStamp && (
                        <p className="py-2 text-center text-[11px] text-slate-400">{formatStamp(message.createdAt)}</p>
                      )}
                      <div className={clsx('flex', message.mine ? 'justify-end' : 'justify-start')}>
                        <div
                          className={clsx(
                            'max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug',
                            message.mine
                              ? 'rounded-br-md bg-[#072348] text-white'
                              : 'rounded-bl-md bg-[#eef1f6] text-slate-800',
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messagesLoading && messages.length === 0 && (
                  <p className="pt-10 text-center text-xs text-slate-400">Hãy gửi lời chào đầu tiên.</p>
                )}
              </div>
              <form
                className="border-t border-slate-100 bg-white px-3 py-2.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSend();
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={draft}
                    onChange={(event) => onDraft(event.target.value)}
                    maxLength={2000}
                    placeholder="Aa"
                    className="h-10 min-w-0 flex-1 rounded-full bg-slate-100 px-3 text-sm outline-none placeholder:text-slate-400 focus:bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={draft.trim().length === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8872A] text-white disabled:opacity-40"
                    aria-label="Gửi"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {sendError && <p className="mt-1 text-[11px] text-rose-600">Chưa gửi được. Thử lại sau.</p>}
              </form>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="px-3 pt-3">
                <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm kiếm"
                    className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
              </div>
              <ul className="mt-2 min-h-0 flex-1 overflow-y-auto">
                {shown.length === 0 && (
                  <li className="px-3 py-8 text-center text-xs text-slate-400">Không có hội thoại.</li>
                )}
                {shown.map((thread) => (
                  <li key={thread.connectionId}>
                    <button
                      type="button"
                      onClick={() => onPick(thread)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <DockAvatar name={thread.peerName} companyId={thread.profile?.logoCompanyId} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-900">{thread.peerName}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {thread.lastAt ? formatClock(thread.lastAt) : ''}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500">
                            {thread.lastBody ?? thread.peerHint ?? 'Bắt đầu trò chuyện'}
                          </span>
                          {thread.unread > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
                              {thread.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={onOpen}
          className="pointer-events-auto relative mr-[18px] flex h-14 w-14 items-center justify-center rounded-full bg-[#072348] text-white shadow-lg shadow-[#072348]/30 transition hover:scale-105 sm:mr-7"
          aria-label="Mở tin nhắn"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function DockAvatar({ name, companyId }: { name: string; companyId?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (companyId && !broken) {
    return (
      <img
        src={`${apiPublicBase()}/companies/${companyId}/logo`}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full bg-white object-contain ring-1 ring-slate-200"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ProfilePane({ thread }: { thread: ConnectionChatThread }) {
  const profile = thread.profile;
  const kindLabel = profile?.kind === 'company' ? 'Nhà tuyển dụng' : profile?.kind === 'candidate' ? 'Ứng viên' : null;
  const briefLabels = profile?.kind === 'company' ? ['Quy mô', 'Địa điểm'] : ['Kinh nghiệm', 'Khu vực'];
  const facts = (profile?.facts ?? []).filter((fact) => briefLabels.includes(fact.label)).slice(0, 2);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <PeerPhoto name={thread.peerName} companyId={profile?.logoCompanyId ?? null} />
        {kindLabel && (
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kindLabel}</p>
        )}
        <p className={clsx('text-sm font-semibold text-brand-700', kindLabel ? 'mt-0.5' : 'mt-3')}>{thread.peerName}</p>
        <p className="mt-0.5 text-xs text-slate-500">{profile?.headline ?? thread.peerHint ?? 'Đối tác kết nối'}</p>
        {facts.length > 0 && (
          <dl className="mt-4 space-y-2">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{fact.label}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-slate-700">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {profile?.path && (
        <div className="border-t border-slate-100 px-4 py-3">
          <Link
            href={profile.path}
            className="flex h-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Xem hồ sơ
          </Link>
        </div>
      )}
    </div>
  );
}

function PeerPhoto({ name, companyId }: { name: string; companyId: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!companyId || broken) return <PeerMark name={name} large />;
  return (
    <img
      src={`${apiPublicBase()}/companies/${companyId}/logo`}
      alt=""
      className="h-14 w-14 rounded-2xl bg-white object-contain ring-1 ring-slate-200"
      onError={() => setBroken(true)}
    />
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

function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${time} ${day}`;
}
