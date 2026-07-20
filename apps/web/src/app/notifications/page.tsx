'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
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

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Thông báo</h1>
          <p className="mt-1 text-slate-500">
            {unread > 0 ? `${unread} chưa đọc` : 'Đã đọc hết'}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Đánh dấu đã đọc tất cả
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-slate-500">Đang tải...</p>}
        {!isLoading && items.length === 0 && (
          <Card className="text-center">
            <Bell className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-3 text-slate-600">Chưa có thông báo nào.</p>
          </Card>
        )}
        {items.map((n) => {
          const content = (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className={`font-semibold ${n.readAt ? 'text-slate-800' : 'text-slate-900'}`}>
                  {n.title}
                </p>
                <span className="text-xs text-slate-400">{formatTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{n.body}</p>
            </>
          );

          return (
            <Card
              key={n.id}
              className={n.readAt ? 'border-slate-200' : 'border-brand-200 bg-brand-50/30'}
            >
              {n.link ? (
                <Link
                  href={n.link}
                  className="block"
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n.id);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n.id);
                  }}
                >
                  {content}
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
