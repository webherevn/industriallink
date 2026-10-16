'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  } catch {
    return iso;
  }
}

export function CrmNotificationsPanel() {
  const queryClient = useQueryClient();
  const inbox = useQuery({
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
  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unreadCount ?? 0;

  return (
    <CrmFrame
      kicker="Trong ứng dụng"
      title="Thông báo"
      description="Chuông của tài khoản đang đăng nhập. Đăng ký qua mã cộng tác viên hiện ở đây, không gửi email."
      footnote="Bấm một dòng để mở đúng danh sách. Không tạo đơn và không bật gói."
    >
      {unread > 0 ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm font-medium text-[#4c3ec9] underline disabled:opacity-60"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            Đánh dấu đã đọc tất cả
          </button>
        </div>
      ) : null}
      {inbox.isLoading ? <CrmEmpty>Đang tải thông báo…</CrmEmpty> : null}
      {inbox.isError ? <CrmEmpty>Không tải được thông báo.</CrmEmpty> : null}
      {inbox.data && items.length === 0 ? <CrmEmpty>Chưa có thông báo.</CrmEmpty> : null}
      {items.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-[22px] bg-white crm-surface">
          {items.map((item) => {
            const row = (
              <>
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-1 text-xs text-slate-400">{formatTime(item.createdAt)}</p>
              </>
            );
            return (
              <li key={item.id} className={item.readAt ? 'bg-white' : 'bg-[#f4f2fb]'}>
                {item.link ? (
                  <Link
                    href={item.link}
                    className="block px-4 py-3"
                    onClick={() => {
                      if (!item.readAt) markOne.mutate(item.id);
                    }}
                  >
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left"
                    onClick={() => {
                      if (!item.readAt) markOne.mutate(item.id);
                    }}
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </CrmFrame>
  );
}
