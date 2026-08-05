import {
  B2bExperienceBand,
  EDUCATION_LEVELS,
  SkillLevel,
  normalizeDealTypeValue,
  normalizeSellingStage,
} from '@industriallink/contracts';
import type {
  ParsedResume,
  ParsedResumeContact,
  ParsedResumeEducation,
  ParsedResumeExperience,
  ParsedResumeProject,
  ParsedResumeSkill,
  ResumeParseInput,
} from '../domain/types';

const SELLING_STAGE_HINT =
  'Tìm kiếm khách hàng|Tiếp cận|Xác định nhu cầu|Khảo sát|Tư vấn sản phẩm|Xây dựng giải pháp|Báo giá|Thuyết trình|Đàm phán|Chốt hợp đồng|Triển khai/giao hàng|Thu hồi công nợ|Chăm sóc/bán thêm';

export const RESUME_SYSTEM_PROMPT = [
  'Bạn là chuyên gia tuyển dụng Sales B2B / kỹ thuật công nghiệp tại Việt Nam.',
  'Nhiệm vụ: ĐỌC HIỂU TOÀN BỘ CV và trích XUẤT ĐẦY ĐỦ mọi dữ liệu có thật vào JSON.',
  'Quy tắc bắt buộc:',
  '1) Chỉ lấy thông tin có trong CV — KHÔNG bịa công ty, số liệu, bằng cấp, SĐT, sở thích.',
  '2) Nếu không thấy trường nào → null hoặc [] — KHÔNG đoán.',
  '3) careerObjective: SAO CHÉP NGUYÊN VĂN mục "Mục tiêu nghề nghiệp" / "Career Objective" / "Objective" nếu có. KHÔNG thay bằng summary. Không để null khi CV có mục này.',
  '4) summary: tóm tắt tổng quan kinh nghiệm (khác careerObjective).',
  '5) contact: birthDate → YYYY-MM-DD nếu có; birthYear nếu suy được. Theo địa giới VN mới (01/7/2025): currentCity = tỉnh/thành (34 đơn vị); ward = xã/phường. Không dùng huyện (district luôn null).',
  '6) education: BẮT BUỘC trích nếu CV có mục Học vấn/Education. level chỉ một trong: THPT | Trung cấp | Cao đẳng | Đại học | Sau đại học.',
  '7) hobbies: trích mục Sở thích / Interests / Hobbies (vd: đọc sách, bóng đá) — từng mục một phần tử mảng.',
  '8) Với MỖI công ty: responsibilities[] phải liệt kê ĐẦY ĐỦ mọi nhiệm vụ/bullet trong CV (không rút gọn). Ví dụ Sales Manager: lên kế hoạch, mục tiêu KD, nghiên cứu SP/đối thủ, đào tạo, đề xuất phương án, báo cáo lãnh đạo... — giữ nguyên ý CV.',
  '9) jobDescription = ghép responsibilities thành văn bản; highlights = thành tích/KPI/kết quả (không thay thế responsibilities).',
  '10) Số tiền quy VND số nguyên (1.2 tỷ → 1200000000). KPI % nếu có.',
  '11) sellingStages chỉ dùng:',
  `    ${SELLING_STAGE_HINT}`,
  '12) b2bExperienceBand: under_1 | 1_3 | 3_5 | 5_10 | 10_plus',
  '13) dealType: equipment|consumables|service|technical_solution|project|rental|other|null (Thiết bị / Vật tư tiêu hao / Dịch vụ / Giải pháp kỹ thuật / Dự án / Cho thuê thiết bị / Khác)',
  '14) missingFields chỉ mã thật sự thiếu: revenue|kpi|newCustomerRatio|dealValue|sellingStages|products|customerSegments|markets|industries|responsibilities',
  '15) jobTrack: "sales" nếu CV thiên doanh số/KPI/bán hàng; "technical" nếu thiên bảo trì/lắp đặt/PLC/thiết bị/kỹ sư dịch vụ. Chỉ null khi không suy được.',
  '16) Kỹ thuật: brandsTechnologies, technicalWorkTypes (Thiết kế|Bảo trì|Commissioning…), technicalAutonomyLevel 1-5, troubleshootingLevel 1-5, technicalTools, documentLiteracy, systemScaleNote, shiftFlexibility yes|limited|no.',
  '17) Thiết bị/hệ thống → productsSold; môi trường làm việc (FDI/EPC…) → customerSegments — dùng chung field, không tạo field trùng.',
  '18) Khi jobTrack=technical: salesHighlights = dự án/thành tích nổi bật theo format "Tên dự án → thiết bị → vai trò → quy mô → kết quả (bao nhiêu dự án đảm bảo đúng thời hạn)". Ưu tiên số liệu đúng hạn nếu CV có.',
  '19) Trả DUY NHẤT JSON hợp lệ, không markdown.',
  '',
  'Schema JSON:',
  '{',
  '  "contact": {',
  '    "fullName": string|null, "email": string|null, "phone": string|null,',
  '    "currentCity": string|null, "district": string|null, "ward": string|null,',
  '    "birthYear": number|null, "birthDate": string|null',
  '  },',
  '  "summary": string,',
  '  "careerObjective": string|null,',
  '  "currentPosition": string|null, "jobLevel": string|null,',
  '  "totalExperienceYears": number|null, "b2bExperienceBand": string|null,',
  '  "industry": string|null, "specialization": string|null,',
  '  "jobTrack": "sales"|"technical"|null,',
  '  "skills": [{"name": string, "level": "beginner"|"intermediate"|"advanced"|"expert", "yearsOfExperience": number|null}],',
  '  "softSkills": string[],',
  '  "experiences": [{',
  '    "companyName": string, "jobTitle": string,',
  '    "startYear": number|null, "endYear": number|null, "isCurrent": boolean,',
  '    "productsSold": string[], "customerSegments": string[], "marketsCovered": string[],',
  '    "industries": string[], "sellingStages": string[],',
  '    "latestRevenue": number|null, "kpiAchievementPct": number|null, "newCustomerRatioPct": number|null,',
  '    "dealType": string|null, "typicalDealValue": number|null, "maxDealValue": number|null,',
  '    "responsibilities": string[],',
  '    "highlights": string|null, "jobDescription": string|null,',
  '    "missingFields": string[]',
  '  }],',
  '  "education": [{"school": string, "degree": string|null, "major": string|null, "level": string|null, "startYear": number|null, "endYear": number|null}],',
  '  "certificates": string[],',
  '  "languages": string[],',
  '  "hobbies": string[],',
  '  "projects": [{"name": string, "detail": string|null}],',
  '  "productsSold": string[], "customerSegments": string[], "marketsCovered": string[],',
  '  "industriesExperienced": string[], "sellingStages": string[],',
  '  "desiredPositions": string[], "desiredLocations": string[],',
  '  "expectedSalaryMin": number|null, "expectedSalaryMax": number|null, "expectedOte": number|null,',
  '  "hasB2License": boolean|null, "driverLicenseType": string|null, "travelAbility": string|null,',
  '  "jobReadiness": string|null, "availabilityBand": string|null,',
  '  "salesHighlights": string|null,',
  '  "brandsTechnologies": string[], "technicalWorkTypes": string[],',
  '  "technicalAutonomyLevel": number|null, "troubleshootingLevel": number|null,',
  '  "technicalTools": string[], "documentLiteracy": string[],',
  '  "systemScaleNote": string|null, "shiftFlexibility": string|null,',
  '  "strengths": string[], "weaknesses": string[], "careerPath": string|null,',
  '  "aiScore": number, "confidence": number',
  '}',
].join('\n');

export function buildResumeUserPrompt(input: ResumeParseInput): string {
  const hasFile = Boolean(input.fileBytes?.length);
  const textBlock = input.text?.trim()
    ? input.text.trim()
    : hasFile
      ? '(Không trích được text cục bộ — hãy đọc trực tiếp từ file đính kèm và trích xuất đầy đủ.)'
      : '(không trích được nội dung, hãy suy luận hợp lý từ tên file — chỉ khi không có dữ liệu khác)';

  return [
    `Tên file: ${input.fileName}`,
    input.mimeType ? `MIME: ${input.mimeType}` : '',
    '',
    'Nội dung CV (text đã trích):',
    textBlock,
    '',
    'Ưu tiên kiểm tra và điền: Mục tiêu nghề nghiệp, Ngày sinh, Xã/phường, Tỉnh/thành, Học vấn, Sở thích,',
    'jobTrack (sales|technical), và responsibilities[] ĐẦY ĐỦ cho từng công ty. Không điền huyện.',
    'Hãy trích xuất TOÀN BỘ thông tin có trong CV vào đúng schema JSON.',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

/** Trích JSON từ output LLM (chịu được trường hợp có ```json ... ```). */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Không tìm thấy JSON trong output LLM');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asSkillLevel(value: unknown): SkillLevel {
  const allowed = Object.values(SkillLevel) as string[];
  return allowed.includes(value as SkillLevel) ? (value as SkillLevel) : SkillLevel.Intermediate;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '').replace(/tỷ/gi, '000000000').replace(/triệu/gi, '000000');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function strArr(v: unknown, max = 40): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, max);
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  if (v === 'false' || v === 0) return false;
  return null;
}

function normalizeJobTrack(v: unknown): 'sales' | 'technical' | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'sales' || s === 'kinh doanh') return 'sales';
  if (s === 'technical' || s === 'tech' || s === 'kỹ thuật' || s === 'ky thuat') return 'technical';
  return null;
}

function level1to5(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

function normalizeShiftFlexibility(v: unknown): string | null {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'yes' || s === 'có' || s === 'co') return 'yes';
  if (s === 'limited' || s === 'có giới hạn' || s === 'co gioi han') return 'limited';
  if (s === 'no' || s === 'không' || s === 'khong') return 'no';
  return null;
}

function normalizeBand(raw: unknown, years: number | null): string | null {
  const s = str(raw);
  const allowed = Object.values(B2bExperienceBand) as string[];
  if (s && allowed.includes(s)) return s;
  if (years == null) return null;
  if (years < 1) return B2bExperienceBand.Under1;
  if (years < 3) return B2bExperienceBand.From1To3;
  if (years < 5) return B2bExperienceBand.From3To5;
  if (years < 10) return B2bExperienceBand.From5To10;
  return B2bExperienceBand.Over10;
}

function normalizeDealType(raw: unknown): string | null {
  return normalizeDealTypeValue(typeof raw === 'string' ? raw : str(raw));
}

function normalizeStages(raw: unknown): string[] {
  return strArr(raw)
    .map((x) => normalizeSellingStage(x) ?? x)
    .filter(Boolean)
    .slice(0, 20);
}

/** Map trình độ học vấn về nhãn UI (THPT / Trung cấp / ...). */
export function normalizeEducationLevel(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  if ((EDUCATION_LEVELS as readonly string[]).includes(s)) return s;
  const lower = s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (/thpt|pho thong|trung hoc pho thong/.test(lower)) return 'THPT';
  if (/trung cap|trung_cap/.test(lower)) return 'Trung cấp';
  if (/cao dang|cao_dang|college/.test(lower)) return 'Cao đẳng';
  if (/sau dai hoc|thac si|tien si|master|phd|postgraduate|sau_dai_hoc/.test(lower))
    return 'Sau đại học';
  if (/dai hoc|dai_hoc|cu nhan|ky su|bachelor|university|undergraduate/.test(lower))
    return 'Đại học';
  return s;
}

/** Chuẩn hoá ngày sinh → ISO YYYY-MM-DD nếu parse được. */
export function normalizeBirthDate(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const ymd = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return s;
}

function birthYearFromDate(birthDate: string | null, birthYear: number | null): number | null {
  if (birthYear != null && birthYear >= 1950 && birthYear <= 2015) return Math.round(birthYear);
  if (!birthDate) return null;
  const m = birthDate.match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1950 && y <= 2015 ? y : null;
}

function splitDuties(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n|•|●|▪|–|- |\u2022/)
    .map((x) => x.replace(/^[\s\-•●▪]+/, '').trim())
    .filter((x) => x.length >= 8)
    .slice(0, 40);
}

function buildJobDescription(
  responsibilities: string[],
  jobDescription: string | null,
): string | null {
  if (responsibilities.length > 0) {
    return responsibilities.map((r) => (r.startsWith('•') ? r : `• ${r}`)).join('\n');
  }
  return jobDescription;
}

function computeMissing(exp: {
  productsSold: string[];
  customerSegments: string[];
  marketsCovered: string[];
  industries: string[];
  sellingStages: string[];
  responsibilities: string[];
  latestRevenue: number | null;
  kpiAchievementPct: number | null;
  newCustomerRatioPct: number | null;
  typicalDealValue: number | null;
  maxDealValue: number | null;
  fromModel: string[];
}): string[] {
  const auto: string[] = [];
  if (!exp.productsSold.length) auto.push('products');
  if (!exp.customerSegments.length) auto.push('customerSegments');
  if (!exp.marketsCovered.length) auto.push('markets');
  if (!exp.industries.length) auto.push('industries');
  if (!exp.sellingStages.length) auto.push('sellingStages');
  if (!exp.responsibilities.length) auto.push('responsibilities');
  if (exp.latestRevenue == null) auto.push('revenue');
  if (exp.kpiAchievementPct == null) auto.push('kpi');
  if (exp.newCustomerRatioPct == null) auto.push('newCustomerRatio');
  if (exp.typicalDealValue == null && exp.maxDealValue == null) auto.push('dealValue');
  const allowed = new Set([
    'revenue',
    'kpi',
    'newCustomerRatio',
    'dealValue',
    'sellingStages',
    'products',
    'customerSegments',
    'markets',
    'industries',
    'responsibilities',
  ]);
  return [...new Set([...exp.fromModel.filter((x) => allowed.has(x)), ...auto])].slice(0, 12);
}

/** Chuẩn hoá JSON thô từ LLM về ParsedResume, điền mặc định an toàn. */
export function normalizeParsedResume(raw: unknown): ParsedResume {
  const r = (raw ?? {}) as Record<string, unknown>;
  const contactRaw = (r.contact ?? {}) as Record<string, unknown>;

  const skills: ParsedResumeSkill[] = (Array.isArray(r.skills) ? r.skills : [])
    .slice(0, 50)
    .map((s) => {
      const skill = (s ?? {}) as Record<string, unknown>;
      return {
        name: String(skill.name ?? '').trim() || 'Unknown',
        level: asSkillLevel(skill.level),
        yearsOfExperience: num(skill.yearsOfExperience),
      };
    })
    .filter((s) => s.name !== 'Unknown');

  const experiences: ParsedResumeExperience[] = (Array.isArray(r.experiences) ? r.experiences : [])
    .slice(0, 12)
    .map((item) => {
      const e = (item ?? {}) as Record<string, unknown>;
      const productsSold = strArr(e.productsSold);
      const customerSegments = strArr(e.customerSegments);
      const marketsCovered = strArr(e.marketsCovered);
      const industries = strArr(e.industries);
      const sellingStages = normalizeStages(e.sellingStages);
      const latestRevenue = num(e.latestRevenue);
      const kpiAchievementPct = num(e.kpiAchievementPct);
      const newCustomerRatioPct = num(e.newCustomerRatioPct);
      const typicalDealValue = num(e.typicalDealValue);
      const maxDealValue = num(e.maxDealValue);
      const fromResp = strArr(e.responsibilities, 40);
      const jobDescriptionRaw = str(e.jobDescription);
      const responsibilities =
        fromResp.length > 0 ? fromResp : splitDuties(jobDescriptionRaw);
      const jobDescription = buildJobDescription(responsibilities, jobDescriptionRaw);
      const highlights = str(e.highlights);
      return {
        companyName: str(e.companyName) || 'Công ty chưa rõ',
        jobTitle: str(e.jobTitle) || 'Sales',
        startYear: num(e.startYear),
        endYear: num(e.endYear),
        isCurrent: Boolean(e.isCurrent),
        productsSold,
        customerSegments,
        marketsCovered,
        industries,
        sellingStages,
        latestRevenue,
        kpiAchievementPct,
        newCustomerRatioPct,
        dealType: normalizeDealType(e.dealType),
        typicalDealValue,
        maxDealValue,
        responsibilities,
        highlights,
        // Ưu tiên mô tả nhiệm vụ đầy đủ; nếu thiếu highlights thì vẫn giữ jobDescription để UI hiện
        jobDescription: jobDescription ?? highlights,
        missingFields: computeMissing({
          productsSold,
          customerSegments,
          marketsCovered,
          industries,
          sellingStages,
          responsibilities,
          latestRevenue,
          kpiAchievementPct,
          newCustomerRatioPct,
          typicalDealValue,
          maxDealValue,
          fromModel: strArr(e.missingFields),
        }),
      };
    });

  const education: ParsedResumeEducation[] = (Array.isArray(r.education) ? r.education : [])
    .slice(0, 8)
    .map((item) => {
      const e = (item ?? {}) as Record<string, unknown>;
      return {
        school: str(e.school) || 'Chưa rõ trường',
        degree: str(e.degree),
        major: str(e.major),
        level: normalizeEducationLevel(e.level) ?? normalizeEducationLevel(e.degree),
        startYear: num(e.startYear),
        endYear: num(e.endYear),
      };
    })
    .filter((e) => e.school !== 'Chưa rõ trường' || e.degree || e.major);

  const projects: ParsedResumeProject[] = (Array.isArray(r.projects) ? r.projects : [])
    .slice(0, 12)
    .map((item) => {
      const p = (item ?? {}) as Record<string, unknown>;
      return {
        name: str(p.name) || 'Dự án',
        detail: str(p.detail),
      };
    })
    .filter((p) => p.name !== 'Dự án' || p.detail);

  const birthDate = normalizeBirthDate(contactRaw.birthDate);
  const birthYear = birthYearFromDate(birthDate, num(contactRaw.birthYear));
  const totalExperienceYears = num(r.totalExperienceYears);
  const contact: ParsedResumeContact = {
    fullName: str(contactRaw.fullName),
    email: str(contactRaw.email),
    phone: str(contactRaw.phone),
    currentCity: str(contactRaw.currentCity),
    district: null,
    ward: str(contactRaw.ward),
    birthYear,
    birthDate,
  };

  const unionFromExp = (key: keyof Pick<
    ParsedResumeExperience,
    'productsSold' | 'customerSegments' | 'marketsCovered' | 'industries' | 'sellingStages'
  >) => [...new Set(experiences.flatMap((e) => e[key]))];

  const productsSold = strArr(r.productsSold).length
    ? strArr(r.productsSold)
    : unionFromExp('productsSold');
  const customerSegments = strArr(r.customerSegments).length
    ? strArr(r.customerSegments)
    : unionFromExp('customerSegments');
  const marketsCovered = strArr(r.marketsCovered).length
    ? strArr(r.marketsCovered)
    : unionFromExp('marketsCovered');
  const industriesExperienced = strArr(r.industriesExperienced).length
    ? strArr(r.industriesExperienced)
    : unionFromExp('industries');
  const sellingStages = normalizeStages(r.sellingStages).length
    ? normalizeStages(r.sellingStages)
    : unionFromExp('sellingStages');

  const softSkills = strArr(r.softSkills);
  const strengths = strArr(r.strengths);
  // Không lấy summary làm mục tiêu nghề nghiệp
  const careerObjective = str(r.careerObjective);

  return {
    contact,
    summary: str(r.summary) ?? '',
    careerObjective,
    currentPosition: str(r.currentPosition),
    jobLevel: str(r.jobLevel),
    totalExperienceYears,
    b2bExperienceBand: normalizeBand(r.b2bExperienceBand, totalExperienceYears),
    industry: str(r.industry),
    specialization: str(r.specialization),
    skills,
    softSkills: softSkills.length ? softSkills : strengths.slice(0, 8),
    experiences,
    education,
    certificates: strArr(r.certificates),
    languages: strArr(r.languages),
    hobbies: strArr(r.hobbies, 20),
    projects,
    productsSold,
    customerSegments,
    marketsCovered,
    industriesExperienced,
    sellingStages,
    desiredPositions: strArr(r.desiredPositions, 5),
    desiredLocations: strArr(r.desiredLocations, 8),
    expectedSalaryMin: num(r.expectedSalaryMin),
    expectedSalaryMax: num(r.expectedSalaryMax),
    expectedOte: num(r.expectedOte),
    hasB2License: boolOrNull(r.hasB2License),
    driverLicenseType: str(r.driverLicenseType),
    travelAbility: str(r.travelAbility),
    jobReadiness: str(r.jobReadiness),
    availabilityBand: str(r.availabilityBand),
    salesHighlights: str(r.salesHighlights),
    strengths,
    weaknesses: strArr(r.weaknesses),
    careerPath: str(r.careerPath),
    jobTrack: normalizeJobTrack(r.jobTrack) ?? inferJobTrack(r, experiences),
    brandsTechnologies: strArr(r.brandsTechnologies, 24),
    technicalWorkTypes: strArr(r.technicalWorkTypes, 20),
    technicalAutonomyLevel: level1to5(r.technicalAutonomyLevel),
    troubleshootingLevel: level1to5(r.troubleshootingLevel),
    technicalTools: strArr(r.technicalTools, 20),
    documentLiteracy: strArr(r.documentLiteracy, 16),
    systemScaleNote: str(r.systemScaleNote),
    shiftFlexibility: normalizeShiftFlexibility(r.shiftFlexibility),
    aiScore: Math.max(0, Math.min(100, num(r.aiScore) ?? 60)),
    confidence: Math.max(0, Math.min(1, num(r.confidence) ?? 0.7)),
  };
}

/** Suy jobTrack khi LLM không trả — dựa title / trách nhiệm. */
function inferJobTrack(
  r: Record<string, unknown>,
  experiences: ParsedResumeExperience[],
): 'sales' | 'technical' | null {
  const blob = [
    str(r.currentPosition),
    str(r.specialization),
    str(r.summary),
    ...experiences.flatMap((e) => [e.jobTitle, e.jobDescription, ...e.responsibilities]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!blob.trim()) return null;
  const techHits =
    /(bảo trì|sua chua|sửa chữa|plc|scada|commission|lắp đặt|lap dat|kỹ sư dịch vụ|ky su dich vu|tự động hóa|tu dong hoa|máy nén|may nen|chiller|cơ khí|co khi)/i.test(
      blob,
    );
  const salesHits =
    /(doanh số|doanh so|kpi|bán hàng|ban hang|sales|đàm phán|dam phan|khách hàng|khach hang|hoa hồng|hoa hong)/i.test(
      blob,
    );
  if (techHits && !salesHits) return 'technical';
  if (salesHits && !techHits) return 'sales';
  if (techHits && salesHits) {
    // Technical Sales → ưu tiên sales track nếu có KPI/revenue rõ
    if (/(kpi|doanh số|doanh so|revenue|deal)/i.test(blob)) return 'sales';
    return 'technical';
  }
  return null;
}
