export const CAMPAIGN_STATUSES = ['draft', 'active', 'ended', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function campaignStatus(value: string | null | undefined): CampaignStatus | null {
  if (value === 'draft' || value === 'active' || value === 'ended' || value === 'cancelled') return value;
  return null;
}

/** Số nguyên VND. Null khi để trống. Undefined khi chuỗi không phải số nguyên. */
export function parseVnd(value: string | null | undefined): bigint | null | undefined {
  const text = value?.trim() ?? '';
  if (!text) return null;
  if (!/^\d{1,15}$/.test(text)) return undefined;
  return BigInt(text);
}

export function vndAccepted(value: string | null | undefined): boolean {
  const text = value?.trim() ?? '';
  return text === '' || /^\d{1,15}$/.test(text);
}

/** Null khi để trống. Undefined khi ngày không có thật. */
export function parseDay(value: string | null | undefined): Date | null | undefined {
  const text = value?.trim() ?? '';
  if (!text) return null;
  const match = DAY.exec(text);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined as unknown as Date;
  }
  return date;
}

export function dayAccepted(value: string | null | undefined): boolean {
  const text = value?.trim() ?? '';
  if (!text) return true;
  const parsed = parseDay(text);
  return parsed instanceof Date;
}

export function dayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function channelCode(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return slug || 'kenh';
}
