import { ApiError } from '@/lib/api';

export function formatVnd(value: string | null | undefined): string {
  if (!value) return 'Chưa có giá';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `${amount.toLocaleString('vi-VN')}đ`;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 86_400_000;
}

export function leadSourceLabel(source: string): string {
  if (source === 'web') return 'Web';
  if (source === 'zalo') return 'Zalo';
  if (source === 'event') return 'Sự kiện';
  if (source === 'partner') return 'Cộng tác viên';
  return 'Chưa rõ';
}

export function leadStatusLabel(status: string): string {
  if (status === 'converted') return 'Đã có deal';
  if (status === 'unqualified') return 'Không phù hợp';
  return 'Đang mở';
}

export function activityLabel(type: string): string {
  if (type === 'call') return 'Gọi điện';
  if (type === 'zalo') return 'Zalo';
  if (type === 'visit') return 'Gặp mặt';
  if (type === 'stage') return 'Đổi bước';
  return 'Ghi chú';
}

export function renewalLabel(days: number): string {
  if (days > 1) return `Còn ${days} ngày`;
  if (days === 1) return 'Còn 1 ngày';
  if (days === 0) return 'Hết hạn trong hôm nay';
  return `Quá hạn ${Math.abs(days)} ngày`;
}

export function matchesQuery(query: string, parts: Array<string | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => (part ?? '').toLowerCase().includes(needle));
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
