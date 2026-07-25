'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Loader2, UserRoundX, Users } from 'lucide-react';
import Link from 'next/link';
import {
  ConnectionStatus,
  type ConnectionView,
} from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { ApiError } from '@/lib/api';
import {
  acceptConnection,
  listMyConnections,
  rejectConnection,
} from '@/lib/candidate';

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.Pending:
      return 'Chờ phản hồi';
    case ConnectionStatus.Accepted:
      return 'Đã kết nối';
    case ConnectionStatus.Rejected:
      return 'Đã từ chối';
    case ConnectionStatus.Cancelled:
      return 'NTD đã huỷ';
    default:
      return status;
  }
}

function statusClass(status: ConnectionStatus): string {
  switch (status) {
    case ConnectionStatus.Pending:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case ConnectionStatus.Accepted:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case ConnectionStatus.Rejected:
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-200';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function ConnectionsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-connections'],
    queryFn: listMyConnections,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-connections'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-connections'] }),
  });

  const items = data ?? [];
  const pending = items.filter((c) => c.status === ConnectionStatus.Pending);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl animate-soft-rise">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yêu cầu kết nối</h1>
            <p className="mt-1 text-sm text-slate-500">
              Nhà tuyển dụng cần bạn đồng ý trước khi xem SĐT/email.
              {pending.length > 0 ? ` Có ${pending.length} yêu cầu đang chờ.` : ''}
            </p>
          </div>
          <Link
            href="/notifications"
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            Xem thông báo
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
              Đang tải…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              {error instanceof ApiError
                ? error.message
                : 'Không tải được danh sách kết nối'}
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-14 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Chưa có yêu cầu kết nối nào
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Khi NTD quan tâm hồ sơ, yêu cầu sẽ hiện tại đây.
              </p>
            </div>
          )}

          {items.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              busy={
                (acceptMutation.isPending && acceptMutation.variables === conn.id) ||
                (rejectMutation.isPending && rejectMutation.variables === conn.id)
              }
              onAccept={() => acceptMutation.mutate(conn.id)}
              onReject={() => rejectMutation.mutate(conn.id)}
              error={
                (acceptMutation.variables === conn.id &&
                  acceptMutation.error instanceof ApiError &&
                  acceptMutation.error.message) ||
                (rejectMutation.variables === conn.id &&
                  rejectMutation.error instanceof ApiError &&
                  rejectMutation.error.message) ||
                null
              }
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ConnectionCard({
  connection,
  busy,
  onAccept,
  onReject,
  error,
}: {
  connection: ConnectionView;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  error: string | null;
}) {
  const pending = connection.status === ConnectionStatus.Pending;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{connection.companyName}</p>
              <p className="text-xs text-slate-400">
                Gửi lúc {formatTime(connection.requestedAt)}
              </p>
            </div>
          </div>
          {connection.message && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {connection.message}
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusClass(connection.status)}`}
        >
          {statusLabel(connection.status)}
        </span>
      </div>

      {error && (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      )}

      {pending && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Đồng ý kết nối
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:flex-none"
          >
            <UserRoundX className="h-3.5 w-3.5" />
            Từ chối
          </button>
        </div>
      )}
    </div>
  );
}
