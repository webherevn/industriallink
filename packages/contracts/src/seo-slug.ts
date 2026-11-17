/** UUID v1–v8 — dùng để phân biệt param id cũ với slug SEO. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Tên/tiêu đề tiếng Việt → slug URL (không dấu, gạch ngang). */
export function toSeoSlug(input: string): string {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return raw || 'muc';
}

/**
 * Nếu `base` đã có thì thêm -1, -2, -3… (không đụng bản gốc).
 */
export function nextUniqueSlug(base: string, taken: Iterable<string | null | undefined>): string {
  const used = new Set(
    [...taken].filter((s): s is string => Boolean(s && s.trim())),
  );
  if (!used.has(base)) return base;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function toSlugSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const JOB_TITLE_JUNK_PREFIX_RE = /^(?:hot|tuyen-dung|can-tuyen|tuyen-gap|ung-tuyen-ngay)-+/;

const COMPANY_LEGAL_SLUG_PREFIXES = [
  'cong-ty-tnhh-mot-thanh-vien-',
  'cong-ty-tnhh-mtv-',
  'cong-ty-tnhh-thuong-mai-va-dich-vu-',
  'cong-ty-tnhh-tm-va-dv-',
  'cong-ty-tnhh-san-xuat-va-thuong-mai-',
  'cong-ty-tnhh-sx-va-tm-',
  'cong-ty-tnhh-sx-tm-',
  'cong-ty-tnhh-',
  'cong-ty-co-phan-',
  'cong-ty-cp-',
  'tap-doan-',
  'chi-nhanh-',
  'thuong-mai-va-dich-vu-',
  'tm-va-dv-',
  'san-xuat-va-thuong-mai-',
  'sx-va-tm-',
  'sx-tm-',
];

export function shortenB2BCompanySlug(companyName?: string | null): string {
  if (!companyName?.trim()) return '';
  let slug = toSlugSegment(companyName);
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of COMPANY_LEGAL_SLUG_PREFIXES) {
      if (slug.startsWith(prefix) && slug.length > prefix.length) {
        slug = slug.slice(prefix.length).replace(/^-+/, '');
        changed = true;
        break;
      }
    }
  }
  return slug;
}

function extractPrimaryLocationSlug(location?: string | null): string {
  if (!location?.trim()) return '';
  const firstPart = location.split(/[,;/|]+/)[0]?.trim() ?? '';
  let loc = toSlugSegment(firstPart);
  if (!loc) return '';
  if (loc === 'tphcm' || loc === 'tp-hcm' || loc === 'hcm') return 'ho-chi-minh';
  if (loc === 'hn') return 'ha-noi';
  loc = loc.replace(/^(?:thanh-pho|tp|tinh)-+/, '');
  return loc;
}

const SLUG_STOP_WORDS = new Set(['va', 'cho', 'tai', 'cac', 'cua', 'theo', 'voi', 'trong']);

function containsContextTokens(baseSlug: string, contextSlug: string): boolean {
  if (!contextSlug) return true;
  if (baseSlug.includes(contextSlug)) return true;
  const baseTokens = new Set(baseSlug.split('-').filter(Boolean));
  const ctxTokens = contextSlug
    .split('-')
    .filter((t) => t.length >= 2 && !SLUG_STOP_WORDS.has(t));
  if (ctxTokens.length === 0) return true;
  return ctxTokens.every((t) => baseTokens.has(t));
}

export function isDemoJobCode(code?: string | null): boolean {
  return Boolean(code && /^JOB-DEMO-/i.test(code.trim()));
}

/** Rút gọn mã tin tuyển dụng (vd: JOB-2026-000014 → j14). */
export function extractJobShortCode(code?: string | null, id?: string | null): string {
  const trimmed = code?.trim() ?? '';
  if (trimmed) {
    if (isDemoJobCode(trimmed)) {
      const m = trimmed.match(/(\d+)$/);
      return m ? `demo${Number.parseInt(m[1], 10)}` : 'demo';
    }
    const m = trimmed.match(/(\d+)$/);
    if (m) {
      return `j${Number.parseInt(m[1], 10)}`;
    }
  }
  if (id?.trim()) {
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanId) return `j${cleanId.slice(0, 6)}`;
  }
  return '';
}

export interface B2BJobSlugInput {
  title: string;
  code?: string | null;
  id?: string | null;
  industry?: string | null;
  location?: string | null;
}

export interface B2BCompanySlugInput {
  name?: string | null;
}

/**
 * Tạo slug chuẩn SEO B2B cho tin tuyển dụng:
 * [tieu-de-vi-tri]-[nganh-hoac-ten-cong-ty-rut-gon]-[khu-vuc-neu-ngan]-[ma-ngan]
 * Tổng độ dài tối đa 80 ký tự (không cắt ngang chữ), luôn kết thúc bằng -[ma-ngan].
 */
export function generateB2BJobSlug(
  job: B2BJobSlugInput,
  company?: B2BCompanySlugInput | null,
): string {
  let titleSlug = toSlugSegment(job.title || '');
  while (JOB_TITLE_JUNK_PREFIX_RE.test(titleSlug)) {
    const stripped = titleSlug.replace(JOB_TITLE_JUNK_PREFIX_RE, '');
    if (stripped.length >= 4) {
      titleSlug = stripped;
    } else {
      break;
    }
  }
  if (!titleSlug) titleSlug = 'viec-lam';

  const industrySlug = job.industry ? toSlugSegment(job.industry) : '';
  const companySlug = company?.name ? shortenB2BCompanySlug(company.name) : '';

  let keywordSlug = titleSlug;
  if (industrySlug && !containsContextTokens(keywordSlug, industrySlug)) {
    keywordSlug = `${keywordSlug}-${industrySlug}`;
  } else if (!industrySlug && companySlug && !containsContextTokens(keywordSlug, companySlug)) {
    keywordSlug = `${keywordSlug}-${companySlug}`;
  }

  const locationSlug = extractPrimaryLocationSlug(job.location);
  if (
    keywordSlug.length < 55 &&
    locationSlug &&
    !containsContextTokens(keywordSlug, locationSlug)
  ) {
    keywordSlug = `${keywordSlug}-${locationSlug}`;
  }

  const shortCode = extractJobShortCode(job.code, job.id);
  const suffix = shortCode ? `-${shortCode}` : '';
  const maxKeywordLen = Math.max(12, 80 - suffix.length);

  if (keywordSlug.length > maxKeywordLen) {
    const cut = keywordSlug.slice(0, maxKeywordLen);
    const nextChar = keywordSlug.charAt(maxKeywordLen);
    if (nextChar && nextChar !== '-') {
      const lastDash = cut.lastIndexOf('-');
      keywordSlug = lastDash > 0 ? cut.slice(0, lastDash) : cut;
    } else {
      keywordSlug = cut.replace(/-+$/g, '');
    }
  }

  return `${keywordSlug}${suffix}` || 'viec-lam';
}

const COMPANY_UPPERCASE_DICTIONARY = new Set([
  'TNHH',
  'MTV',
  'CP',
  'JSC',
  'CO.,LTD',
  'VN',
  'B2B',
  'CNC',
  'PLC',
  'HVAC',
  'MEP',
  'M&E',
  'QA',
  'QC',
  'R&D',
  'ISO',
  'OEM',
  'ODM',
  'EPC',
  'KCN',
  'FDI',
  'SMT',
  'IOT',
  'ERP',
  'PCCC',
  'TĐH',
  'SX',
  'TM',
  'DV',
  'XNK',
]);

function capitalizeFirstUnicodeLetter(word: string): string {
  const lower = word.toLocaleLowerCase('vi-VN');
  const chars = Array.from(lower);
  const idx = chars.findIndex((ch) => /\p{L}/u.test(ch));
  if (idx === -1) return lower;
  chars[idx] = chars[idx].toLocaleUpperCase('vi-VN');
  return chars.join('');
}

function letterCount(word: string): number {
  return Array.from(word).filter((ch) => /\p{L}/u.test(ch)).length;
}

/**
 * Chuẩn hóa hiển thị tên công ty B2B (Unicode tiếng Việt + giữ nguyên từ viết tắt pháp nhân/kỹ thuật).
 * Không ghi đè DB; chỉ dùng cho tầng trình bày (UI, <title>, OG, JSON-LD).
 */
export function formatVietnameseCompanyName(name?: string | null): string {
  const raw = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const isAllUpper = raw === raw.toLocaleUpperCase('vi-VN') && raw !== raw.toLocaleLowerCase('vi-VN');
  const isAllLower = raw === raw.toLocaleLowerCase('vi-VN') && raw !== raw.toLocaleUpperCase('vi-VN');
  const normalizeAllToTitle = isAllUpper || isAllLower;

  return raw
    .split(' ')
    .map((token) => {
      if (!token) return token;
      const match = token.match(/^([("'\[{]*)(.*?)([)"'\]}.,;:!?]*)$/);
      const lead = match?.[1] ?? '';
      const core = match?.[2] ?? token;
      const trail = match?.[3] ?? '';
      if (!core) return token;

      const coreWithTrailingDot = `${core}${trail.startsWith('.') ? '.' : ''}`;
      const dictKeyWithDot = coreWithTrailingDot.toLocaleUpperCase('vi-VN');
      if (COMPANY_UPPERCASE_DICTIONARY.has(dictKeyWithDot)) {
        const remainingTrail = trail.startsWith('.') ? trail.slice(1) : trail;
        return `${lead}${dictKeyWithDot}${remainingTrail}`;
      }

      const dictKey = core.toLocaleUpperCase('vi-VN');
      if (COMPANY_UPPERCASE_DICTIONARY.has(dictKey)) {
        return `${lead}${dictKey}${trail}`;
      }

      if (
        !normalizeAllToTitle &&
        letterCount(core) >= 2 &&
        core === core.toLocaleUpperCase('vi-VN') &&
        core !== core.toLocaleLowerCase('vi-VN')
      ) {
        return token;
      }

      // Xử lý từ có dấu gạch nối (vd: việt-nhật)
      if (core.includes('-')) {
        const formattedCore = core
          .split('-')
          .map((part) => {
            const partUpper = part.toLocaleUpperCase('vi-VN');
            if (COMPANY_UPPERCASE_DICTIONARY.has(partUpper)) return partUpper;
            return capitalizeFirstUnicodeLetter(part);
          })
          .join('-');
        return `${lead}${formattedCore}${trail}`;
      }

      return `${lead}${capitalizeFirstUnicodeLetter(core)}${trail}`;
    })
    .join(' ');
}
