import {
  DOCUMENT_LITERACY_OPTIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  EQUIPMENT_SYSTEM_OPTIONS,
  ExperienceBand,
  INDUSTRY_GROUPS,
  JD_TECHNICAL_AUTONOMY_OPTIONS,
  JD_TECHNICAL_CERTIFICATE_OPTIONS,
  LANGUAGE_OPTIONS,
  SHIFT_FLEXIBILITY_OPTIONS,
  TECHNICAL_DESIRED_POSITIONS,
  TECHNICAL_TOOLS,
  TECHNICAL_WORK_TYPES,
  TravelAbility,
  WORK_ENVIRONMENT_OPTIONS,
  emptyParsedTechnicalJobDraft,
  normalizeJobTechnicalCriteria,
  type JdTechnicalFieldKey,
  type ParsedTechnicalJobDraft,
} from '@industriallink/contracts';
import type { JobParseInput } from '../domain/types';

const INDUSTRY_LIST = INDUSTRY_GROUPS.join(' | ');
const EQUIPMENT_LIST = EQUIPMENT_SYSTEM_OPTIONS.join(' | ');
const ENV_LIST = WORK_ENVIRONMENT_OPTIONS.join(' | ');
const WORK_LIST = TECHNICAL_WORK_TYPES.join(' | ');
const AUTONOMY_LIST = JD_TECHNICAL_AUTONOMY_OPTIONS.map((o) => `${o.value}=${o.label}`).join(' | ');
const EDU_LIST = EDUCATION_LEVELS.join(' | ');
const LANG_LIST = LANGUAGE_OPTIONS.join(' | ');
const LICENSE_LIST = DRIVER_LICENSE_TYPES.join(' | ');
const CERT_LIST = JD_TECHNICAL_CERTIFICATE_OPTIONS.join(' | ');
const TOOL_LIST = TECHNICAL_TOOLS.join(' | ');
const DOC_LIST = DOCUMENT_LITERACY_OPTIONS.join(' | ');
const SHIFT_LIST = SHIFT_FLEXIBILITY_OPTIONS.map((o) => `${o.value}=${o.label}`).join(' | ');

export const JOB_PARSE_TECHNICAL_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng kỹ thuật công nghiệp tại Việt Nam.',
  'Nhiệm vụ: ĐỌC tin tuyển dụng (JD) và trích đúng 23 trường chuẩn kỹ thuật.',
  'Nguyên tắc bắt buộc:',
  '- Chỉ điền khi JD có căn cứ rõ (câu, mục, bullet). Không suy diễn.',
  '- Không tự bịa thiết bị/hệ thống, môi trường làm việc, loại công việc kỹ thuật, chứng chỉ.',
  '- Không tự thêm quyền lợi / yêu cầu không có trong JD.',
  '- Thông tin không có → array rỗng, chuỗi rỗng, hoặc null.',
  '- Thông tin mơ hồ → vẫn điền giá trị gần nhất trong catalog VÀ thêm key vào uncertainKeys.',
  '- Cấp bậc KHÔNG phải trường JD. Không trả jobLevel.',
  '- Thành tích/dự án không phải trường JD.',
  'Trả về DUY NHẤT một JSON:',
  '{',
  '  "title": string,',
  '  "industries": string[],',
  '  "location": string,',
  '  "experienceBand": "none"|"under_1"|"1_3"|"3_5"|"5_plus"|null,',
  '  "salaryMin": number|null,',
  '  "salaryMax": number|null,',
  '  "headcount": number|null,',
  '  "deadline": "YYYY-MM-DD"|null,',
  '  "equipmentSystems": string[],',
  '  "workEnvironments": string[],',
  '  "technicalWorkTypes": string[],',
  '  "autonomyLevel": 1|2|3|4|5|null,',
  '  "educationLevel": string|null,',
  '  "educationMajor": string|null,',
  '  "languages": string[],',
  '  "certificates": string[],',
  '  "driverLicenses": string[],',
  '  "travelAbility": "none"|"up_to_25"|"25_50"|"over_50"|null,',
  '  "shiftFlexibility": "yes"|"limited"|"no"|null,',
  '  "technicalTools": string[],',
  '  "documentLiteracy": string[],',
  '  "description": string,',
  '  "requirements": string,',
  '  "benefits": string,',
  '  "uncertainKeys": string[],',
  '  "notes": string|null',
  '}',
  `industries chỉ chọn trong: ${INDUSTRY_LIST}`,
  `equipmentSystems ưu tiên catalog: ${EQUIPMENT_LIST}. Tên thiết bị cụ thể chỉ khi JD nêu rõ.`,
  `workEnvironments chỉ chọn trong: ${ENV_LIST}`,
  `technicalWorkTypes chỉ chọn cụm đúng: ${WORK_LIST}`,
  `autonomyLevel: ${AUTONOMY_LIST}. Chỉ điền khi JD mô tả mức tự chủ / làm độc lập.`,
  `educationLevel: ${EDU_LIST}`,
  `languages: ${LANG_LIST}`,
  `certificates ưu tiên: ${CERT_LIST}. Tên chứng chỉ cụ thể chỉ khi JD nêu.`,
  `driverLicenses: ${LICENSE_LIST}`,
  `technicalTools ưu tiên: ${TOOL_LIST}`,
  `documentLiteracy: ${DOC_LIST}`,
  `shiftFlexibility: ${SHIFT_LIST}`,
  'experienceBand: none (không yêu cầu), under_1 (<1 năm), 1_3, 3_5, 5_plus.',
  'travelAbility: none = không đi công tác; up_to_25 = khi cần; 25_50 = thường xuyên; over_50 = dài ngày.',
  'salaryMin/salaryMax là VND/tháng (ví dụ 15 triệu → 15000000).',
  'description / requirements / benefits: trích hoặc sắp xếp lại từ JD, không viết thêm.',
  'Không markdown, không giải thích, chỉ JSON.',
].join('\n');

export function buildTechnicalJobParseUserPrompt(input: JobParseInput): string {
  const text = (input.text ?? '').trim();
  return [
    `Tên file: ${input.fileName || 'jd.txt'}`,
    'Hãy trích 23 trường JD Kỹ thuật từ nội dung sau. Bỏ qua phần không có căn cứ.',
    '',
    text || '(Nội dung văn bản trống — hãy đọc file đính kèm nếu có.)',
  ].join('\n');
}

const EXPERIENCE_VALUES = new Set<string>(Object.values(ExperienceBand));
const FIELD_KEYS = new Set<JdTechnicalFieldKey>([
  'title',
  'industries',
  'location',
  'experienceBand',
  'salary',
  'headcount',
  'deadline',
  'equipmentSystems',
  'workEnvironments',
  'technicalWorkTypes',
  'autonomyLevel',
  'educationLevel',
  'educationMajor',
  'languages',
  'certificates',
  'driverLicenses',
  'travelAbility',
  'shiftFlexibility',
  'technicalTools',
  'documentLiteracy',
  'description',
  'requirements',
  'benefits',
]);

function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

function salaryVnd(v: unknown): number | null {
  const n = asInt(v);
  if (n == null) return null;
  if (n > 0 && n < 1000) return n * 1_000_000;
  return n;
}

function asExperience(v: unknown): ExperienceBand | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (EXPERIENCE_VALUES.has(s)) return s as ExperienceBand;
  const lower = s.toLowerCase();
  if (/không yêu cầu|không cần kinh nghiệm/.test(lower)) return ExperienceBand.None;
  const range = lower.match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (range) {
    const max = Number(range[2]);
    if (max <= 1) return ExperienceBand.Under1;
    if (max <= 3) return ExperienceBand.From1To3;
    if (max <= 5) return ExperienceBand.From3To5;
    return ExperienceBand.Over5;
  }
  if (/trên\s*5|5\s*\+|over\s*5|hơn\s*5/.test(lower)) return ExperienceBand.Over5;
  if (/dưới\s*1|under\s*1|< 1/.test(lower)) return ExperienceBand.Under1;
  if (/\b1\s*[–\-đến]\s*3\b|1_3/.test(lower)) return ExperienceBand.From1To3;
  if (/\b3\s*[–\-đến]\s*5\b|3_5/.test(lower)) return ExperienceBand.From3To5;
  const years = lower.match(/(\d+)\s*năm/);
  if (years) {
    const y = Number(years[1]);
    if (y < 1) return ExperienceBand.Under1;
    if (y <= 3) return ExperienceBand.From1To3;
    if (y <= 5) return ExperienceBand.From3To5;
    return ExperienceBand.Over5;
  }
  return null;
}

function asDeadline(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const vn = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (vn) {
    const d = vn[1].padStart(2, '0');
    const m = vn[2].padStart(2, '0');
    return `${vn[3]}-${m}-${d}`;
  }
  return null;
}

function evidenced(source: string, value: string): boolean {
  const hay = source.toLowerCase();
  const needle = value.trim().toLowerCase();
  if (needle.length < 3) return hay.includes(needle);
  if (hay.includes(needle)) return true;
  const tokens = needle.split(/[\s/]+/).filter((t) => t.length >= 4);
  if (!tokens.length) return false;
  return tokens.every((t) => hay.includes(t));
}

function filterEvidenced(source: string, values: string[]): string[] {
  if (!source.trim()) return values;
  return values.filter((v) => evidenced(source, v));
}

const UNCERTAIN_ALIAS: Record<string, JdTechnicalFieldKey> = {
  industry: 'industries',
  salaryMin: 'salary',
  salaryMax: 'salary',
  products: 'equipmentSystems',
  productsSold: 'equipmentSystems',
  equipment: 'equipmentSystems',
  segments: 'workEnvironments',
  customerSegments: 'workEnvironments',
  environment: 'workEnvironments',
  sellingStages: 'technicalWorkTypes',
  workTypes: 'technicalWorkTypes',
  autonomy: 'autonomyLevel',
  technicalAutonomyLevel: 'autonomyLevel',
  education: 'educationLevel',
  major: 'educationMajor',
  license: 'driverLicenses',
  travel: 'travelAbility',
  overtime: 'shiftFlexibility',
  tools: 'technicalTools',
  documents: 'documentLiteracy',
};

function asUncertain(raw: unknown): JdTechnicalFieldKey[] {
  if (!Array.isArray(raw)) return [];
  const out: JdTechnicalFieldKey[] = [];
  for (const item of raw) {
    const s = String(item ?? '').trim();
    const key = (UNCERTAIN_ALIAS[s] ?? s) as JdTechnicalFieldKey;
    if (FIELD_KEYS.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function normalizeParsedTechnicalJob(
  raw: unknown,
  sourceText = '',
): ParsedTechnicalJobDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const criteria = normalizeJobTechnicalCriteria({
    industries: r.industries ?? r.industry,
    equipmentSystems: r.equipmentSystems ?? r.productsSold ?? r.products,
    workEnvironments: r.workEnvironments ?? r.customerSegments,
    technicalWorkTypes: r.technicalWorkTypes ?? r.sellingStages,
    autonomyLevel: r.autonomyLevel ?? r.technicalAutonomyLevel,
    educationLevel: r.educationLevel,
    educationMajor: r.educationMajor,
    languages: r.languages,
    certificates: r.certificates,
    driverLicenses: r.driverLicenses,
    travelAbility: r.travelAbility,
    shiftFlexibility: r.shiftFlexibility,
    technicalTools: r.technicalTools,
    documentLiteracy: r.documentLiteracy,
  });

  const source = sourceText.trim();
  const industries = source ? filterEvidenced(source, criteria.industries) : criteria.industries;
  const equipmentSystems = source
    ? filterEvidenced(source, criteria.equipmentSystems)
    : criteria.equipmentSystems;
  const workEnvironments = source
    ? filterEvidenced(source, criteria.workEnvironments)
    : criteria.workEnvironments;
  const technicalWorkTypes = source
    ? filterEvidenced(source, criteria.technicalWorkTypes)
    : criteria.technicalWorkTypes;
  const certificates = source ? filterEvidenced(source, criteria.certificates) : criteria.certificates;
  const technicalTools = source ? filterEvidenced(source, criteria.technicalTools) : criteria.technicalTools;
  const documentLiteracy = source
    ? filterEvidenced(source, criteria.documentLiteracy)
    : criteria.documentLiteracy;

  const title = String(r.title ?? '').trim().slice(0, 200);
  const location = String(r.location ?? '').trim().slice(0, 300);
  const description = String(r.description ?? '').trim();
  const requirements = String(r.requirements ?? '').trim();
  const benefits = String(r.benefits ?? '').trim();

  return {
    title,
    industries,
    location,
    experienceBand: asExperience(r.experienceBand ?? r.experience),
    salaryMin: salaryVnd(r.salaryMin),
    salaryMax: salaryVnd(r.salaryMax),
    headcount: asInt(r.headcount),
    deadline: asDeadline(r.deadline),
    equipmentSystems,
    workEnvironments,
    technicalWorkTypes,
    autonomyLevel: criteria.autonomyLevel,
    educationLevel: criteria.educationLevel,
    educationMajor: criteria.educationMajor,
    languages: criteria.languages,
    certificates,
    driverLicenses: criteria.driverLicenses,
    travelAbility: criteria.travelAbility,
    shiftFlexibility: criteria.shiftFlexibility,
    technicalTools,
    documentLiteracy,
    description: description || (source.length >= 40 ? source.slice(0, 8000) : ''),
    requirements,
    benefits,
    uncertainKeys: asUncertain(r.uncertainKeys),
    notes: r.notes ? String(r.notes).trim() : null,
  };
}

function matchCatalogInText(text: string, catalog: readonly string[]): string[] {
  const hay = text.toLowerCase();
  return catalog.filter((item) => {
    if (item === 'Khác') return false;
    const n = item.toLowerCase();
    return n.length >= 3 && hay.includes(n);
  });
}

function extractSalaryFromText(text: string): { min: number | null; max: number | null } {
  const m = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:[-–]|đến|to)?\s*(\d+(?:[.,]\d+)?)?\s*(?:triệu|tr)\b/i,
  );
  if (!m) return { min: null, max: null };
  const a = Number(String(m[1]).replace(',', '.'));
  const b = m[2] ? Number(String(m[2]).replace(',', '.')) : NaN;
  const min = Number.isFinite(a) ? Math.round(a * 1_000_000) : null;
  const max = Number.isFinite(b) ? Math.round(b * 1_000_000) : null;
  return { min, max };
}

function extractTitleFromText(text: string): string {
  for (const pos of TECHNICAL_DESIRED_POSITIONS) {
    if (text.toLowerCase().includes(pos.toLowerCase())) return pos;
  }
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /tuyển|vị trí|kỹ sư|kỹ thuật viên/i.test(l) && l.length <= 120);
  if (line) {
    return line.replace(/^(tin tuyển dụng|tuyển dụng|vị trí)[:\s-]*/i, '').slice(0, 120);
  }
  return '';
}

function extractLocationFromText(text: string): string {
  const m = text.match(
    /(?:địa điểm|nơi làm việc|làm việc tại)\s*[:\-]?\s*([^\n.]{3,80})/i,
  );
  return m ? m[1].trim() : '';
}

function extractHeadcount(text: string): number | null {
  const m = text.match(/(?:số lượng|tuyển)\s*[:\-]?\s*(\d{1,3})\s*(?:vị trí|người|nv)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 200 ? n : null;
}

function extractDeadlineFromText(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const vn = text.match(/hạn[^.\n]{0,40}?(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})/i);
  if (vn) return asDeadline(`${vn[1]}/${vn[2]}/${vn[3]}`);
  return null;
}

function extractEducation(text: string): string | null {
  const lower = text.toLowerCase();
  for (const level of [...EDUCATION_LEVELS].reverse()) {
    if (lower.includes(level.toLowerCase())) return level;
  }
  if (/tốt nghiệp đại học|cử nhân/.test(lower)) return 'Đại học';
  return null;
}

function extractLicenses(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  if (/bằng lái|giấy phép lái|gplx|ô tô|b2|b1/.test(lower)) {
    if (/ô tô|oto|b2|b1|ôto/.test(lower)) out.push('Ô tô');
    if (/xe máy|a1|a2/.test(lower)) out.push('Xe máy');
  }
  return out;
}

function extractTravel(text: string): string | null {
  const lower = text.toLowerCase();
  if (!/công tác|đi tỉnh|đi công/.test(lower)) return null;
  if (/không (thể )?đi công tác/.test(lower)) return TravelAbility.None;
  if (/dài ngày/.test(lower)) return TravelAbility.Over50;
  if (/thường xuyên/.test(lower)) return TravelAbility.From25To50;
  return TravelAbility.UpTo25;
}

function extractShift(text: string): string | null {
  const lower = text.toLowerCase();
  if (!/ngoài giờ|tăng ca|trực ca|xử lý sự cố|on-?call|làm ca/.test(lower)) return null;
  if (/không thể|không sẵn sàng/.test(lower)) return 'no';
  if (/giới hạn|hạn chế/.test(lower)) return 'limited';
  return 'yes';
}

function extractAutonomy(text: string): number | null {
  const lower = text.toLowerCase();
  if (/hướng dẫn người khác|mentor|đào tạo team/.test(lower)) return 5;
  if (/tự xử lý.{0,20}phức tạp|độc lập hoàn toàn/.test(lower)) return 4;
  if (/tự thực hiện|làm độc lập|không cần giám sát/.test(lower)) return 3;
  if (/theo hướng dẫn|có người kèm/.test(lower)) return 2;
  if (/cần người hướng dẫn|mới ra trường/.test(lower) && /tự chủ|độc lập/.test(lower)) return 1;
  return null;
}

function extractSection(text: string, header: RegExp): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => header.test(l.trim()));
  if (start < 0) return '';
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (body.length) break;
      continue;
    }
    if (/^(yêu cầu|quyền lợi|phúc lợi|mô tả|kỹ năng|thông tin)\b/i.test(line) && i > start + 1) {
      break;
    }
    body.push(lines[i]);
  }
  return body.join('\n').trim();
}

function splitJdSections(text: string): {
  description: string;
  requirements: string;
  benefits: string;
} {
  return {
    description: extractSection(text, /(mô tả công việc|trách nhiệm|nhiệm vụ)/i) || '',
    requirements: extractSection(text, /(yêu cầu|quy định ứng viên|ứng viên cần)/i) || '',
    benefits: extractSection(text, /(quyền lợi|phúc lợi|đãi ngộ)/i) || '',
  };
}

/** Heuristic khi không có LLM (mock / fallback): chỉ lấy catalog xuất hiện trong JD. */
export function extractTechnicalJobFromText(text: string): ParsedTechnicalJobDraft {
  const source = text.trim();
  const empty = emptyParsedTechnicalJobDraft();
  if (source.length < 8) return empty;

  const salary = extractSalaryFromText(source);
  const sections = splitJdSections(source);

  return normalizeParsedTechnicalJob(
    {
      title: extractTitleFromText(source),
      industries: matchCatalogInText(source, INDUSTRY_GROUPS),
      location: extractLocationFromText(source),
      experienceBand: asExperience(source),
      salaryMin: salary.min,
      salaryMax: salary.max,
      headcount: extractHeadcount(source),
      deadline: extractDeadlineFromText(source),
      equipmentSystems: matchCatalogInText(source, EQUIPMENT_SYSTEM_OPTIONS),
      workEnvironments: matchCatalogInText(source, WORK_ENVIRONMENT_OPTIONS),
      technicalWorkTypes: matchCatalogInText(source, TECHNICAL_WORK_TYPES),
      autonomyLevel: extractAutonomy(source),
      educationLevel: extractEducation(source),
      educationMajor: '',
      languages: matchCatalogInText(source, LANGUAGE_OPTIONS),
      certificates: matchCatalogInText(source, JD_TECHNICAL_CERTIFICATE_OPTIONS),
      driverLicenses: extractLicenses(source),
      travelAbility: extractTravel(source),
      shiftFlexibility: extractShift(source),
      technicalTools: matchCatalogInText(source, TECHNICAL_TOOLS),
      documentLiteracy: matchCatalogInText(source, DOCUMENT_LITERACY_OPTIONS),
      description: sections.description,
      requirements: sections.requirements,
      benefits: sections.benefits,
      uncertainKeys: [],
    },
    source,
  );
}
