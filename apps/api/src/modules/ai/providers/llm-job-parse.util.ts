import {
  CUSTOMER_SEGMENTS,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  DESIRED_POSITIONS,
  DRIVER_LICENSE_TYPES,
  EDUCATION_LEVELS,
  EmploymentType,
  ExperienceBand,
  INDUSTRY_GROUPS,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  PRODUCTS_SOLD,
  SELLING_STAGES,
  TravelAbility,
  emptyParsedSalesJobDraft,
  normalizeJobSalesCriteria,
  type JdSalesFieldKey,
  type ParsedSalesJobDraft,
} from '@industriallink/contracts';
import type { JobParseInput } from '../domain/types';

const INDUSTRY_LIST = INDUSTRY_GROUPS.join(' | ');
const PRODUCT_LIST = PRODUCTS_SOLD.join(' | ');
const SEGMENT_LIST = CUSTOMER_SEGMENTS.join(' | ');
const DEAL_LIST = DEAL_TYPE_OPTIONS.map((v) => `${v}=${DEAL_TYPE_LABEL[v]}`).join(' | ');
const STAGE_LIST = SELLING_STAGES.join(' | ');
const MARKET_LIST = MARKET_REGIONS.join(' | ');
const EDU_LIST = EDUCATION_LEVELS.join(' | ');
const LANG_LIST = LANGUAGE_OPTIONS.join(' | ');
const LICENSE_LIST = DRIVER_LICENSE_TYPES.join(' | ');

export const JOB_PARSE_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng Sales B2B công nghiệp tại Việt Nam.',
  'Nhiệm vụ: ĐỌC tin tuyển dụng (JD) và trích đúng 22 trường chuẩn.',
  'Nguyên tắc bắt buộc:',
  '- Chỉ điền khi JD có căn cứ rõ (câu, mục, bullet). Không suy diễn.',
  '- Không tự bịa sản phẩm, ngành, nhóm khách hàng, thị trường, loại hình kinh doanh.',
  '- Không tự thêm quyền lợi / yêu cầu không có trong JD.',
  '- Thông tin không có → array rỗng, chuỗi rỗng, hoặc null.',
  '- Thông tin mơ hồ → vẫn điền giá trị gần nhất trong catalog VÀ thêm key vào uncertainKeys.',
  '- Cấp bậc KHÔNG phải trường JD. Không trả jobLevel.',
  'Trả về DUY NHẤT một JSON:',
  '{',
  '  "title": string,',
  '  "industries": string[],',
  '  "employmentType": "full_time"|"part_time"|"contract"|"internship"|"seasonal"|null,',
  '  "location": string,',
  '  "experienceBand": "none"|"under_1"|"1_3"|"3_5"|"5_plus"|null,',
  '  "salaryMin": number|null,',
  '  "salaryMax": number|null,',
  '  "headcount": number|null,',
  '  "deadline": "YYYY-MM-DD"|null,',
  '  "productsSold": string[],',
  '  "customerSegments": string[],',
  '  "dealTypes": string[],',
  '  "sellingStages": string[],',
  '  "marketsCovered": string[],',
  '  "educationLevel": string|null,',
  '  "educationMajor": string|null,',
  '  "languages": string[],',
  '  "driverLicenses": string[],',
  '  "travelAbility": "none"|"up_to_25"|"25_50"|"over_50"|null,',
  '  "description": string,',
  '  "requirements": string,',
  '  "skills": string[],',
  '  "benefits": string,',
  '  "uncertainKeys": string[],',
  '  "notes": string|null',
  '}',
  `industries chỉ chọn trong: ${INDUSTRY_LIST}`,
  `productsSold ưu tiên catalog: ${PRODUCT_LIST}. Tên thiết bị cụ thể chỉ khi JD nêu rõ.`,
  `customerSegments chỉ chọn trong: ${SEGMENT_LIST}`,
  `dealTypes mã: ${DEAL_LIST}`,
  `sellingStages chỉ chọn cụm đúng: ${STAGE_LIST}`,
  `marketsCovered chỉ chọn trong: ${MARKET_LIST}`,
  `educationLevel: ${EDU_LIST}`,
  `languages: ${LANG_LIST}`,
  `driverLicenses: ${LICENSE_LIST}`,
  'experienceBand: none (không yêu cầu), under_1 (<1 năm), 1_3, 3_5, 5_plus.',
  'travelAbility: none = không đi công tác; up_to_25 = khi cần; 25_50 = thường xuyên; over_50 = dài ngày.',
  'salaryMin/salaryMax là VND/tháng (ví dụ 15 triệu → 15000000).',
  'description / requirements / benefits: trích hoặc sắp xếp lại từ JD, không viết thêm.',
  'Không markdown, không giải thích, chỉ JSON.',
].join('\n');

export function buildJobParseUserPrompt(input: JobParseInput): string {
  const text = (input.text ?? '').trim();
  return [
    `Tên file: ${input.fileName || 'jd.txt'}`,
    'Hãy trích 22 trường JD Sales B2B từ nội dung sau. Bỏ qua phần không có căn cứ.',
    '',
    text || '(Nội dung văn bản trống — hãy đọc file đính kèm nếu có.)',
  ].join('\n');
}

const EMPLOYMENT_VALUES = new Set<string>(Object.values(EmploymentType));
const EXPERIENCE_VALUES = new Set<string>(Object.values(ExperienceBand));
const FIELD_KEYS = new Set<JdSalesFieldKey>([
  'title',
  'industries',
  'employmentType',
  'location',
  'experienceBand',
  'salary',
  'headcount',
  'deadline',
  'productsSold',
  'customerSegments',
  'dealTypes',
  'sellingStages',
  'marketsCovered',
  'educationLevel',
  'educationMajor',
  'languages',
  'driverLicenses',
  'travelAbility',
  'description',
  'requirements',
  'skills',
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

function asEmployment(v: unknown): EmploymentType | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (EMPLOYMENT_VALUES.has(s)) return s as EmploymentType;
  const lower = s.toLowerCase();
  if (/toàn thời|full[\s_-]?time/.test(lower)) return EmploymentType.FullTime;
  if (/bán thời|part[\s_-]?time/.test(lower)) return EmploymentType.PartTime;
  if (/hợp đồng|contract/.test(lower)) return EmploymentType.Contract;
  if (/thực tập|intern/.test(lower)) return EmploymentType.Internship;
  if (/thời vụ|season/.test(lower)) return EmploymentType.Seasonal;
  return null;
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

const UNCERTAIN_ALIAS: Record<string, JdSalesFieldKey> = {
  industry: 'industries',
  salaryMin: 'salary',
  salaryMax: 'salary',
  products: 'productsSold',
  segments: 'customerSegments',
  dealType: 'dealTypes',
  stages: 'sellingStages',
  markets: 'marketsCovered',
  education: 'educationLevel',
  major: 'educationMajor',
  license: 'driverLicenses',
  travel: 'travelAbility',
};

function asUncertain(raw: unknown): JdSalesFieldKey[] {
  if (!Array.isArray(raw)) return [];
  const out: JdSalesFieldKey[] = [];
  for (const item of raw) {
    const s = String(item ?? '').trim();
    const key = (UNCERTAIN_ALIAS[s] ?? s) as JdSalesFieldKey;
    if (FIELD_KEYS.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Chuẩn hoá JSON LLM → 22 trường JD Sales.
 * Bỏ giá trị catalog không có căn cứ trong văn bản nguồn (chống suy diễn).
 */
export function normalizeParsedSalesJob(
  raw: unknown,
  sourceText = '',
): ParsedSalesJobDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const criteria = normalizeJobSalesCriteria({
    industries: r.industries ?? r.industry,
    productsSold: r.productsSold ?? r.products,
    customerSegments: r.customerSegments ?? r.segments,
    dealTypes: r.dealTypes ?? r.dealType,
    sellingStages: r.sellingStages,
    marketsCovered: r.marketsCovered ?? r.markets,
    educationLevel: r.educationLevel,
    educationMajor: r.educationMajor,
    languages: r.languages,
    driverLicenses: r.driverLicenses,
    travelAbility: r.travelAbility,
  });

  const source = sourceText.trim();
  const industries = source ? filterEvidenced(source, criteria.industries) : criteria.industries;
  const productsSold = source ? filterEvidenced(source, criteria.productsSold) : criteria.productsSold;
  const customerSegments = source
    ? filterEvidenced(source, criteria.customerSegments)
    : criteria.customerSegments;
  const sellingStages = source ? filterEvidenced(source, criteria.sellingStages) : criteria.sellingStages;
  const marketsCovered = source
    ? filterEvidenced(source, criteria.marketsCovered)
    : criteria.marketsCovered;

  const dealTypes = source
    ? criteria.dealTypes.filter((code) => {
        const label = DEAL_TYPE_LABEL[code as keyof typeof DEAL_TYPE_LABEL] ?? code;
        return evidenced(source, label) || evidenced(source, code);
      })
    : criteria.dealTypes;

  const skills = Array.isArray(r.skills)
    ? r.skills
        .map((s) => {
          if (typeof s === 'string') return s.trim();
          const o = (s ?? {}) as Record<string, unknown>;
          return String(o.name ?? '').trim();
        })
        .filter(Boolean)
        .slice(0, 30)
    : [];

  const title = String(r.title ?? '').trim().slice(0, 200);
  const location = String(r.location ?? '').trim().slice(0, 300);
  const description = String(r.description ?? '').trim();
  const requirements = String(r.requirements ?? '').trim();
  const benefits = String(r.benefits ?? '').trim();

  return {
    title,
    industries,
    employmentType: asEmployment(r.employmentType),
    location,
    experienceBand: asExperience(r.experienceBand ?? r.experience),
    salaryMin: salaryVnd(r.salaryMin),
    salaryMax: salaryVnd(r.salaryMax),
    headcount: asInt(r.headcount),
    deadline: asDeadline(r.deadline),
    productsSold,
    customerSegments,
    dealTypes,
    sellingStages,
    marketsCovered,
    educationLevel: criteria.educationLevel,
    educationMajor: criteria.educationMajor,
    languages: criteria.languages,
    driverLicenses: criteria.driverLicenses,
    travelAbility: criteria.travelAbility,
    description: description || (source.length >= 40 ? source.slice(0, 8000) : ''),
    requirements,
    skills: source ? skills.filter((s) => evidenced(source, s) || s.length <= 24) : skills,
    benefits,
    uncertainKeys: asUncertain(r.uncertainKeys),
    notes: r.notes ? String(r.notes).trim() : null,
  };
}

function matchCatalogInText(text: string, catalog: readonly string[]): string[] {
  const hay = text.toLowerCase();
  return catalog.filter((item) => {
    if (item === 'Khác' || item === 'Thiết bị công nghiệp khác') return false;
    const n = item.toLowerCase();
    if (n.length < 4) return hay.includes(n);
    return hay.includes(n);
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
  for (const pos of DESIRED_POSITIONS) {
    if (text.toLowerCase().includes(pos.toLowerCase())) return pos;
  }
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /tuyển|vị trí|nhân viên kinh doanh|sales/i.test(l) && l.length <= 120);
  if (line) {
    return line.replace(/^(tin tuyển dụng|tuyển dụng|vị trí)[:\s-]*/i, '').slice(0, 120);
  }
  return '';
}

function extractExperienceFromText(text: string): ExperienceBand | null {
  return asExperience(text);
}

function extractEmploymentFromText(text: string): EmploymentType | null {
  return asEmployment(text);
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

function extractLocationFromText(text: string): string {
  const m = text.match(
    /(?:địa điểm|nơi làm việc|làm việc tại)\s*[:\-]?\s*([^\n.]{3,80})/i,
  );
  return m ? m[1].trim() : '';
}

function extractEducation(text: string): string | null {
  const lower = text.toLowerCase();
  for (const level of [...EDUCATION_LEVELS].reverse()) {
    if (lower.includes(level.toLowerCase())) return level;
  }
  if (/tốt nghiệp đại học|cử nhân/.test(lower)) return 'Đại học';
  return null;
}

function extractLanguages(text: string): string[] {
  return matchCatalogInText(text, LANGUAGE_OPTIONS);
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

function extractDealTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  if (/vật tư tiêu hao|consumables/.test(lower)) out.push('consumables');
  if (/dịch vụ kỹ thuật|cho thuê thiết bị/.test(lower)) out.push('service');
  if (/giải pháp kỹ thuật/.test(lower)) out.push('technical_solution');
  if (/\bdự án\b/.test(lower) && /bán|kinh doanh|giải pháp/.test(lower)) out.push('project');
  if (/bán thiết bị|loại hình[^\n]{0,40}thiết bị/.test(lower)) out.push('equipment');
  return out;
}

function splitJdSections(text: string): {
  description: string;
  requirements: string;
  benefits: string;
} {
  const requirements = extractSection(text, /(yêu cầu|quy định ứng viên|ứng viên cần)/i);
  const benefits = extractSection(text, /(quyền lợi|phúc lợi|đãi ngộ)/i);
  const description = extractSection(text, /(mô tả công việc|trách nhiệm|nhiệm vụ)/i);
  return {
    description: description || '',
    requirements: requirements || '',
    benefits: benefits || '',
  };
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

/**
 * Heuristic khi không có LLM (mock / fallback): chỉ lấy catalog xuất hiện trong JD.
 */
export function extractSalesJobFromText(text: string): ParsedSalesJobDraft {
  const source = text.trim();
  const empty = emptyParsedSalesJobDraft();
  if (source.length < 8) return empty;

  const salary = extractSalaryFromText(source);
  const sections = splitJdSections(source);
  const skillsLine = source.match(/kỹ năng\s*[:\-]?\s*([^\n]+)/i);

  return normalizeParsedSalesJob(
    {
      title: extractTitleFromText(source),
      industries: matchCatalogInText(source, INDUSTRY_GROUPS),
      employmentType: extractEmploymentFromText(source),
      location: extractLocationFromText(source),
      experienceBand: extractExperienceFromText(source),
      salaryMin: salary.min,
      salaryMax: salary.max,
      headcount: extractHeadcount(source),
      deadline: extractDeadlineFromText(source),
      productsSold: matchCatalogInText(source, PRODUCTS_SOLD),
      customerSegments: matchCatalogInText(source, CUSTOMER_SEGMENTS),
      dealTypes: extractDealTypes(source),
      sellingStages: matchCatalogInText(source, SELLING_STAGES),
      marketsCovered: matchCatalogInText(source, MARKET_REGIONS),
      educationLevel: extractEducation(source),
      educationMajor: '',
      languages: extractLanguages(source),
      driverLicenses: extractLicenses(source),
      travelAbility: extractTravel(source),
      description: sections.description,
      requirements: sections.requirements,
      skills: skillsLine
        ? skillsLine[1].split(/[,;•]/).map((s) => s.trim()).filter(Boolean)
        : [],
    benefits: sections.benefits || '',
    uncertainKeys: [],
  },
  source,
);
}
