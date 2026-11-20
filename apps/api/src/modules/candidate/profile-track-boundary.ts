import {
  FIELD_EMPTY_VALUE,
  fieldsToClearForTrack,
  normalizeTrack,
  sanitizeDesiredPositions,
} from './profile-track-sanitize';

/**
 * Sanitize ho so theo ranh gioi linh vuc (STRICT BOUNDARY).
 *
 * - Muc 1-12 (thong tin chung): GIU NGUYEN 100%.
 * - Muc 13+ : chi giu du lieu cua DUY NHAT 1 linh vuc dang active.
 *   Luu voi `technical` -> xoa sach toan bo field dac thu cua Kinh doanh.
 *   Luu voi `sales`     -> xoa sach toan bo field dac thu cua Ky thuat.
 * - `desiredPositions` (muc 13): loc bo gia tri cua nhanh con lai truoc khi
 *   kiem tra gioi han length <= 3.
 */
export function sanitizeProfileForTrack<T extends Record<string, unknown>>(
  profile: T,
  jobTrack: string | null | undefined,
): T {
  const track = normalizeTrack(jobTrack);
  const cleared = fieldsToClearForTrack(track);

  const next = { ...profile } as Record<string, unknown>;
  for (const field of cleared) {
    // Luôn ghi đè (kể cả khi input không có field) để DB không giữ lại
    // dữ liệu của nhánh cũ. Loại field quyết định giá trị rỗng: array -> [], scalar -> null.
    next[field] = FIELD_EMPTY_VALUE[field] === 'array' ? [] : null;
  }

  // Muc 13 — loai gia tri cua nhanh con lai truoc, roi moi gioi han 3.
  next.desiredPositions = sanitizeDesiredPositions(
    (profile.desiredPositions as readonly string[] | undefined) ?? [],
    track,
  );

  // Chuc danh hien thi chinh (Sidebar trai) — theo vi tri dau tien cua nhanh moi.
  const firstPosition = (next.desiredPositions as string[])[0];
  if (firstPosition) next.currentPosition = firstPosition;

  return next as T;
}
