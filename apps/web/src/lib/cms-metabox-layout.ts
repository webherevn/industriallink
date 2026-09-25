export type CmsMetaboxColumn = 'main' | 'side';

export type CmsMetaboxId =
  | 'excerpt'
  | 'faq'
  | 'seo'
  | 'og'
  | 'publish'
  | 'cover'
  | 'categories'
  | 'author';

export type CmsMetaboxLayout = {
  main: CmsMetaboxId[];
  side: CmsMetaboxId[];
};

export const CMS_METABOX_LABELS: Record<CmsMetaboxId, string> = {
  excerpt: 'Đoạn trích (Excerpt)',
  faq: 'FAQ Schema (FAQPage)',
  seo: 'SEO (Yoast / Rank Math)',
  og: 'Open Graph / Social',
  publish: 'Xuất bản',
  cover: 'Ảnh đại diện',
  categories: 'Danh mục',
  author: 'Tác giả',
};

export const DEFAULT_CMS_METABOX_LAYOUT: CmsMetaboxLayout = {
  main: ['excerpt', 'faq', 'seo', 'og'],
  side: ['publish', 'cover', 'categories', 'author'],
};

const STORAGE_KEY = 'il_cms_metabox_layout_v1';

const ALL_IDS: CmsMetaboxId[] = [
  'excerpt',
  'faq',
  'seo',
  'og',
  'publish',
  'cover',
  'categories',
  'author',
];

function isMetaboxId(v: unknown): v is CmsMetaboxId {
  return typeof v === 'string' && (ALL_IDS as string[]).includes(v);
}

/** Khôi phục layout; bổ sung metabox mới nếu thiếu; bỏ id lạ. */
export function normalizeCmsMetaboxLayout(raw: unknown): CmsMetaboxLayout {
  const base: CmsMetaboxLayout = {
    main: [...DEFAULT_CMS_METABOX_LAYOUT.main],
    side: [...DEFAULT_CMS_METABOX_LAYOUT.side],
  };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as { main?: unknown; side?: unknown };
  const main = Array.isArray(obj.main) ? obj.main.filter(isMetaboxId) : [];
  const side = Array.isArray(obj.side) ? obj.side.filter(isMetaboxId) : [];
  const seen = new Set<CmsMetaboxId>();
  const cleanMain: CmsMetaboxId[] = [];
  const cleanSide: CmsMetaboxId[] = [];
  for (const id of main) {
    if (seen.has(id)) continue;
    seen.add(id);
    cleanMain.push(id);
  }
  for (const id of side) {
    if (seen.has(id)) continue;
    seen.add(id);
    cleanSide.push(id);
  }
  for (const id of ALL_IDS) {
    if (!seen.has(id)) cleanSide.push(id);
  }
  return { main: cleanMain, side: cleanSide };
}

export function loadCmsMetaboxLayout(): CmsMetaboxLayout {
  if (typeof window === 'undefined') return { ...DEFAULT_CMS_METABOX_LAYOUT };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CMS_METABOX_LAYOUT };
    return normalizeCmsMetaboxLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CMS_METABOX_LAYOUT };
  }
}

export function saveCmsMetaboxLayout(layout: CmsMetaboxLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota */
  }
}

/** Di chuyển metabox trong/giữa cột (kiểu WP Screen layout). */
export function moveCmsMetabox(
  layout: CmsMetaboxLayout,
  id: CmsMetaboxId,
  toColumn: CmsMetaboxColumn,
  toIndex: number,
): CmsMetaboxLayout {
  const next: CmsMetaboxLayout = {
    main: layout.main.filter((x) => x !== id),
    side: layout.side.filter((x) => x !== id),
  };
  const target = toColumn === 'main' ? next.main : next.side;
  const idx = Math.max(0, Math.min(toIndex, target.length));
  target.splice(idx, 0, id);
  return next;
}
