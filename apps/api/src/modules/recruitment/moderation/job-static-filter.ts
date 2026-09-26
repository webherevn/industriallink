import type { JobStaticFilterResult } from '@industriallink/contracts';

/**
 * Lớp 1 — Bộ lọc tĩnh (KHÔNG dùng AI). Chạy trực tiếp trên server để chặn
 * sớm tin rác/đa cấp và giảm tải hạn mức Gemini.
 */

/** Ngưỡng tối thiểu cho mô tả (ký tự). Dưới ngưỡng → reject tự động. */
export const MIN_DESCRIPTION_LENGTH = 100;

/**
 * ~90 từ khoá cấm: đa cấp, lừa đảo cọc tiền, việc nhẹ lương cao, spam.
 * Dùng dạng có dấu tiếng Việt; so khớp sau khi bỏ dấu để bắt cả biến thể.
 */
export const BANNED_KEYWORDS: string[] = [
  // Đa cấp / mô hình lừa đảo
  'da cap', 'kinh doanh da cap', 'mlm', 'nhi phan', 'tra thuong theo tang',
  'hoa hong theo tang', 'he thong tuyen duoi', 'tuyen tuyen duoi', 'mo hinh ponzi',
  'ponzi', 'lam giau nhanh', 'lam giau khong kho', 'khong can kinh nghiem van luong cao',
  // Thu tiền cọc / phí
  'dat coc', 'coc tien', 'nop tien coc', 'phi giu cho', 'phi ho so', 'phi dong phuc',
  'phi dao tao truoc', 'nop phi', 'chuyen khoan truoc', 'dong phi truoc',
  'mua bo san pham truoc', 'nap tien', 'nap the', 'the cao', 'nap the dien thoai',
  // Việc nhẹ lương cao / online scam
  'viec nhe luong cao', 'viec nhe', 'luong cao khong can kinh nghiem',
  'lam tai nha thu nhap khung', 'thu nhap khung', 'thu nhap 30 trieu', 'kiem tien online',
  'go captcha', 'like dao', 'seeding dao', 'chot don ao', 'nhiem vu don hang',
  'lam nhiem vu', 'thanh toan don hang', 'ung tien don hang', 'hoan tien don hang',
  'tang tuong tac', 'cay view', 'treo may kiem tien',
  // Sàn/tài chính lừa đảo
  'san forex', 'forex', 'san bo', 'danh bac', 'ca cuoc', 'ca do', 'lo de', 'ta xiu',
  'tien ao lua dao', 'san giao dich ao', 'uy thac dau tu', 'cam ket loi nhuan',
  'loi nhuan 100', 'x2 tai khoan', 'x3 tai khoan', 'chac chan co lai',
  // Tuyển dụng mờ ám
  'khong ro cong ty', 'cong ty ma', 'phong van qua telegram', 'phong van qua zalo',
  'lien he qua telegram', 'ket ban zalo de biet them', 'add zalo nhan viec',
  'tuyen gap khong yeu cau', 'chi can dien thoai', 'chi can cccd', 'giu cccd',
  'the chap giay to', 'giu bang goc', 'nop bang goc',
  // Spam chung
  'hot hot hot', 'sieu hot', 'inbox ngay', 'lien he ngay keo lo', 'so luong co han keo lo',
];

/** Regex bắt link/handle Telegram & Zalo (yêu cầu bắt & buộc xoá). */
const CONTACT_LINK_PATTERNS: RegExp[] = [
  /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/[A-Za-z0-9_+/]+/gi,
  /(?:https?:\/\/)?zalo\.me\/[A-Za-z0-9_./-]+/gi,
  /\btelegram\b\s*[:：]?\s*@?[A-Za-z0-9_]{3,}/gi,
  /\bzalo\b\s*[:：]?\s*(?:0\d{8,10}|@?[A-Za-z0-9_.]{3,})/gi,
  /@[A-Za-z0-9_]{4,}\s*(?:tren\s*)?(?:telegram|zalo)/gi,
];

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp bền vững. */
export function removeVietnameseTones(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function countGraphemes(text: string): number {
  return text.replace(/\s+/g, ' ').trim().length;
}

/**
 * Chạy 3 kiểm tra: từ khoá cấm, độ dài, và link Telegram/Zalo.
 * `blocked = true` nếu vi phạm nghiêm trọng (từ cấm hoặc quá ngắn) → không gọi AI.
 * Link liên hệ ẩn danh KHÔNG tự chặn cứng nhưng được đánh cờ để Admin xử lý.
 */
export function runJobStaticFilter(input: {
  title: string;
  description: string;
  requirements?: string | null;
  benefits?: string | null;
}): JobStaticFilterResult {
  const rawCombined = [input.title, input.description, input.requirements, input.benefits]
    .filter(Boolean)
    .join('\n');
  const normalized = removeVietnameseTones(rawCombined);

  const bannedHits = BANNED_KEYWORDS.filter((kw) => normalized.includes(kw));

  const contactLinks: string[] = [];
  for (const pattern of CONTACT_LINK_PATTERNS) {
    const matches = rawCombined.match(pattern);
    if (matches) contactLinks.push(...matches.map((m) => m.trim()));
  }
  const uniqueLinks = [...new Set(contactLinks)];

  const tooShort = countGraphemes(input.description) < MIN_DESCRIPTION_LENGTH;

  const reasons: string[] = [];
  if (bannedHits.length) {
    reasons.push(`Chứa từ khoá cấm (${bannedHits.slice(0, 5).join(', ')}).`);
  }
  if (tooShort) {
    reasons.push(`Mô tả quá ngắn (< ${MIN_DESCRIPTION_LENGTH} ký tự).`);
  }
  if (uniqueLinks.length) {
    reasons.push(`Có link/handle Telegram/Zalo cần xoá (${uniqueLinks.slice(0, 3).join(', ')}).`);
  }

  return {
    blocked: bannedHits.length > 0 || tooShort,
    bannedHits,
    contactLinks: uniqueLinks,
    tooShort,
    reason: reasons.join(' '),
  };
}
