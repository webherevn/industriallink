const BENEFIT_STARTS = [
  'Lương',
  'Thưởng',
  'Hoa',
  'Được',
  'Có',
  'Lộ',
  'Môi',
  'Tham',
  'Đầy',
  'Thử',
  'Nếu',
  'Hỗ',
  'Phụ',
  'Bảo',
  'Đào',
  'Cơ',
  'Nghỉ',
  'Xe',
  'Ăn',
  'Khám',
  'Chính',
  'Ký',
  'Cộng',
];

const CONNECTORS = new Set([
  'của',
  'cho',
  'tại',
  'về',
  'với',
  'và',
  'hoặc',
  'hay',
  'theo',
  'từ',
  'đến',
  'tới',
  'trong',
  'trên',
  'dưới',
  'các',
  'những',
  'một',
  'khi',
  'để',
  'bằng',
  'như',
  'qua',
  'sau',
  'trước',
  'giữa',
  'ngoài',
  'cùng',
  'mỗi',
  'mọi',
  'này',
  'đó',
  'được',
  'không',
  'sẽ',
  'đã',
  'đang',
  'cần',
  'phải',
  'gồm',
  'ngành',
  'chuyên',
  'thuộc',
  'đối',
  'vào',
  'ra',
  'lên',
  'xuống',
  'lại',
  'rồi',
  'thì',
  'mà',
  'nên',
  'vì',
  'do',
  'bởi',
  'ở',
  'là',
]);

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coreWord(word: string): string {
  return word.replace(/^[("«“]+/u, '').replace(/[),.;:!?»”]+$/u, '');
}

function isUpper(char: string): boolean {
  return /[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/u.test(char);
}

function isLower(char: string): boolean {
  return /[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/u.test(char);
}

function isTitleWord(word: string): boolean {
  const core = coreWord(word);
  const chars = [...core];
  if (chars.length < 2) return false;
  return isUpper(chars[0]) && isLower(chars[1]);
}

function isBenefitStart(word: string): boolean {
  const core = coreWord(word);
  return BENEFIT_STARTS.some((start) => core === start || core.startsWith(start));
}

function canSplitBefore(word: string, prev: string, bufLen: number): boolean {
  const benefit = isBenefitStart(word);
  if (!isTitleWord(word) && !benefit) return false;
  if (/gồm:$/i.test(prev)) return true;
  if (/[.!?]["»”]?$/u.test(prev) && /\p{L}/u.test(prev) && !/^\d+\.$/.test(prev)) return true;
  if (/[:,;–—\-/→(]$/u.test(prev)) return false;
  if (benefit && bufLen >= 2 && /[\p{Ll})]$/u.test(prev)) return true;
  if (isTitleWord(prev)) return false;
  if (CONNECTORS.has(coreWord(prev).toLowerCase())) return false;
  if (!/[\p{Ll})]$/u.test(prev)) return false;
  return bufLen >= 5;
}

function splitRunOn(line: string): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const items: string[] = [];
  let buf: string[] = [];
  for (const word of words) {
    const prev = buf[buf.length - 1];
    if (prev && canSplitBefore(word, prev, buf.length)) {
      items.push(buf.join(' '));
      buf = [word];
    } else {
      buf.push(word);
    }
  }
  if (buf.length) items.push(buf.join(' '));
  return items;
}

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•●▪]|\d+[.)])\s+/u, '').trim();
}

function splitChunk(chunk: string): string[] {
  if (/[•●▪]/u.test(chunk)) {
    return chunk
      .split(/\s*[•●▪]\s*/u)
      .flatMap((part) => splitRunOn(part.trim()))
      .filter(Boolean);
  }
  return splitRunOn(chunk);
}

function collectItems(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => stripBullet(line))
    .filter(Boolean);
  const chunks = lines.length > 1 ? lines : [stripBullet(text)];
  const items: string[] = [];
  for (const chunk of chunks) {
    for (const part of splitChunk(chunk)) {
      const trimmed = part.trim();
      if (trimmed) items.push(trimmed);
    }
  }
  return items;
}

function listHtml(items: string[]): string {
  return `<ul>${items.map((item) => `<li><p>${esc(item)}</p></li>`).join('')}</ul>`;
}

function renderItems(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return `<p>${esc(items[0])}</p>`;
  const lead = /gồm\s*:$/i.test(items[0]);
  if (lead && items.length > 2) {
    return `<p>${esc(items[0])}</p>${listHtml(items.slice(1))}`;
  }
  return listHtml(items);
}

/** Đưa mô tả, yêu cầu, kỹ năng, quyền lợi vào editor dạng danh sách. */
export function toJdListHtml(raw: string | null | undefined): string {
  const text = (raw ?? '').replace(/\u00a0/g, ' ').trim();
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return renderItems(collectItems(text));
}

/** Mỗi kỹ năng một dòng, kể cả khi AI trả về một chuỗi nối bằng dấu phẩy. */
export function skillsToListHtml(skills: string[] | null | undefined): string {
  const items = (skills ?? []).flatMap((skill) => {
    const text = skill.replace(/\u00a0/g, ' ').trim();
    if (!text || /<[a-z][\s\S]*>/i.test(text)) return text ? [text] : [];
    return text
      .split(/[,;|\n]/)
      .flatMap((part) => collectItems(part))
      .map((part) => part.trim())
      .filter(Boolean);
  });
  return renderItems(items);
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Đọc lại tên kỹ năng từ danh sách trong editor. */
export function skillNamesFromEditor(value: string): string[] {
  const html = value.trim();
  if (!html) return [];
  const fromList = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) =>
    stripTags(match[1]),
  );
  const parts = fromList.length > 0 ? fromList : html.split(/[,;\n|]/).map((part) => stripTags(part));
  return parts.filter(Boolean);
}
