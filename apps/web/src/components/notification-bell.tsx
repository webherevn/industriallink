'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { tokenStore } from '@/lib/api';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Chuông thông báo in-app trên AppShell (poll ~30s). */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const enabled = typeof window !== 'undefined' && Boolean(tokenStore.get());

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
    enabled,
    refetchInterval: 30_000,
    retry: false,
  });

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Thông báo"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Thông báo</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-brand-600 hover:underline"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                >
                  Đọc tất cả
                </button>
              )}
              <Link
                href="/notifications"
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => setOpen(false)}
              >
                Xem tất cả
              </Link>
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">Chưa có thông báo</li>
            )}
            {items.slice(0, 8).map((n) => (
              <li key={n.id} className={n.readAt ? 'bg-white' : 'bg-brand-50/40'}>
                {n.link ? (
                  <Link
                    href={n.link}
                    className="block px-4 py-3 hover:bg-slate-50"
                    onClick={() => {
                      if (!n.readAt) markOne.mutate(n.id);
                      setOpen(false);
                    }}
                  >
                    <NotificationRow title={n.title} body={n.body} createdAt={n.createdAt} unread={!n.readAt} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => {
                      if (!n.readAt) markOne.mutate(n.id);
                    }}
                  >
                    <NotificationRow title={n.title} body={n.body} createdAt={n.createdAt} unread={!n.readAt} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  title,
  body,
  createdAt,
  unread,
}: {
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm ${unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
          {title}
        </p>
        <span className="shrink-0 text-[11px] text-slate-400">{formatTime(createdAt)}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{body}</p>
    </>
  );
}
