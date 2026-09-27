import { Injectable } from '@nestjs/common';
import {
  CmsContentStatus,
  CmsContentType,
  cmsCategoryPublicPath,
  type CmsPageRatio,
  type CmsSemanticAssist,
  type CmsSemanticCoverage,
  type CmsSemanticEntity,
  type CmsSemanticIssue,
  type CmsSemanticItem,
  type CmsSemanticRatioVerdict,
  type CmsSemanticReport,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import { inferSkillsFromText } from '../ai/providers/industrial-skills';

const TOPICS: Array<{ name: string; re: RegExp }> = [
  { name: 'Tuyển dụng', re: /tuyển dụng|ứng viên|nhà tuyển dụng/i },
  { name: 'B2B', re: /\bb2b\b/i },
  { name: 'Kinh doanh', re: /kinh doanh|sales|account/i },
  { name: 'Kỹ năng', re: /kỹ năng|năng lực/i },
  { name: 'Quy trình', re: /quy trình|phễu|pipeline/i },
  { name: 'Công nghiệp', re: /công nghiệp|nhà máy|sản xuất|xưởng/i },
  { name: 'Phỏng vấn', re: /phỏng vấn|interview/i },
  { name: 'Lương và đãi ngộ', re: /lương|đãi ngộ|salary|thu nhập/i },
];

/** Checklist thực thể B2B mà Gemini SEO chấm từng mục có hay chưa. */
const B2B_CHECKLIST = [
  'Tuyển dụng B2B',
  'Nhà tuyển dụng hoặc doanh nghiệp',
  'Ứng viên',
  'Vị trí bán hàng B2B hoặc Key Account',
  'Vị trí kỹ thuật hoặc kỹ sư',
  'Ngành công nghiệp hoặc nhà máy',
  'Kỹ năng hoặc công cụ chuyên ngành',
  'Quy trình tuyển dụng hoặc phỏng vấn',
  'Lương và đãi ngộ',
  'Địa điểm hoặc khu công nghiệp',
] as const;

/** Dưới ngưỡng này và ít chữ thì trang bị coi là nhiều mã, thiếu nội dung. */
const PAGE_RATIO_MIN = 10;
const PAGE_TEXT_MIN = 1500;
const CATEGORY_PAGE_LIMIT = 40;

function decode(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function plainText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function stats(html: string): { text: string; textChars: number; htmlChars: number; ratio: number } {
  const text = plainText(html);
  const htmlChars = html.trim().length;
  const textChars = text.length;
  const ratio = htmlChars === 0 ? 0 : Math.round((textChars / htmlChars) * 1000) / 10;
  return { text, textChars, htmlChars, ratio };
}

function outline(html: string): string {
  return [...html.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => `H${match[1]}: ${plainText(match[2] || '')}`)
    .filter((line) => line.length > 4)
    .slice(0, 20)
    .join('\n');
}

function foundEntities(text: string): string[] {
  const names = new Set<string>();
  for (const topic of TOPICS) {
    if (topic.re.test(text)) names.add(topic.name);
  }
  for (const skill of inferSkillsFromText(text)) names.add(skill);
  return [...names];
}

function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
}

function sizeOf(html: string, re: RegExp): number {
  let total = 0;
  for (const match of html.matchAll(re)) total += match[0].length;
  return total;
}

async function measurePage(path: string): Promise<CmsPageRatio> {
  const empty: CmsPageRatio = {
    path,
    htmlChars: 0,
    textChars: 0,
    scriptChars: 0,
    styleChars: 0,
    ratio: 0,
    codeShare: 0,
    verdict: 'warn',
    error: null,
  };
  try {
    const res = await fetch(`${siteBase()}${path}`, {
      headers: { 'user-agent': 'inlink-seo-ratio/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ...empty, error: `Trang trả HTTP ${res.status}` };
    const html = await res.text();
    const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
    const textChars = plainText(body).length;
    const scriptChars = sizeOf(html, /<script\b[\s\S]*?<\/script>/gi);
    const styleChars = sizeOf(html, /<style\b[\s\S]*?<\/style>/gi);
    const htmlChars = html.length;
    const ratio = htmlChars === 0 ? 0 : Math.round((textChars / htmlChars) * 1000) / 10;
    const codeShare = htmlChars === 0 ? 0 : Math.round(((scriptChars + styleChars) / htmlChars) * 1000) / 10;
    return {
      path,
      htmlChars,
      textChars,
      scriptChars,
      styleChars,
      ratio,
      codeShare,
      verdict: ratio < PAGE_RATIO_MIN && textChars < PAGE_TEXT_MIN ? 'warn' : 'good',
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...empty, error: `Không tải được trang: ${message.slice(0, 120)}` };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

@Injectable()
export class SeoSemanticService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AiSettingsService,
  ) {}

  async report(): Promise<CmsSemanticReport> {
    const live = {
      isDeleted: false,
      status: CmsContentStatus.Published,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    };
    const [posts, categories] = await Promise.all([
      this.prisma.cmsPost.findMany({
        where: live,
        select: { id: true, type: true, title: true, bodyHtml: true, excerpt: true },
        orderBy: { publishedAt: 'desc' },
        take: 200,
      }),
      this.prisma.cmsCategory.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, slug: true, description: true },
        orderBy: { sortOrder: 'asc' },
        take: 100,
      }),
    ]);
    const pages = await mapLimit(categories.slice(0, CATEGORY_PAGE_LIMIT), 3, (row) =>
      measurePage(cmsCategoryPublicPath(row.slug)),
    );
    const items: CmsSemanticItem[] = [];
    let ok = 0;
    let thin = 0;
    let markup = 0;
    let fewEntities = 0;
    const consider = (
      row: Omit<CmsSemanticItem, 'issues' | 'entities' | 'page'> & { text: string; page: CmsPageRatio | null },
    ) => {
      const entities = foundEntities(row.text);
      const issues: CmsSemanticIssue[] = [];
      if (row.textChars < 200) issues.push('thin');
      const storedMarkup = row.ratio < 35 && row.htmlChars >= 500 && row.textChars >= 80;
      if (storedMarkup || row.page?.verdict === 'warn') issues.push('markup');
      if (entities.length < 2 && row.textChars >= 250) issues.push('entities');
      if (issues.includes('thin')) thin += 1;
      if (issues.includes('markup')) markup += 1;
      if (issues.includes('entities')) fewEntities += 1;
      if (issues.length === 0) {
        ok += 1;
        return;
      }
      items.push({
        id: row.id,
        kind: row.kind,
        title: row.title,
        editPath: row.editPath,
        textChars: row.textChars,
        htmlChars: row.htmlChars,
        ratio: row.ratio,
        entities,
        issues,
        page: row.page,
      });
    };
    for (const row of posts) {
      const measured = stats([row.bodyHtml, row.excerpt].filter(Boolean).join('\n'));
      consider({
        id: row.id,
        kind: row.type === CmsContentType.Page ? 'page' : 'post',
        title: row.title,
        editPath: row.type === CmsContentType.Page ? `/admin/pages/${row.id}` : `/admin/posts/${row.id}`,
        textChars: measured.textChars,
        htmlChars: measured.htmlChars,
        ratio: measured.ratio,
        text: measured.text,
        page: null,
      });
    }
    categories.forEach((row, index) => {
      const measured = stats(row.description || '');
      consider({
        id: row.id,
        kind: 'category',
        title: row.name,
        editPath: '/admin/categories',
        textChars: measured.textChars,
        htmlChars: measured.htmlChars,
        ratio: measured.ratio,
        text: measured.text,
        page: pages[index] ?? null,
      });
    });
    const rank = (issue: CmsSemanticIssue) => (issue === 'thin' ? 0 : issue === 'markup' ? 1 : 2);
    items.sort((a, b) => {
      const aRank = Math.min(...a.issues.map(rank));
      const bRank = Math.min(...b.issues.map(rank));
      return aRank - bRank || a.ratio - b.ratio;
    });
    return {
      generatedAt: new Date().toISOString(),
      scanned: posts.length + categories.length,
      ok,
      thin,
      markup,
      fewEntities,
      items: items.slice(0, 50),
    };
  }

  async assist(input: {
    title: string;
    focusKeyword?: string;
    html: string;
    publicPath?: string;
  }): Promise<CmsSemanticAssist> {
    const measured = stats(input.html);
    const text = measured.text.slice(0, 12_000);
    const page = input.publicPath ? await measurePage(input.publicPath) : null;
    const base = blankAssist(measured, page);
    if (text.length < 80) {
      return { ...base, note: 'Viết thêm nội dung (khoảng 80 ký tự) để Gemini SEO quét thực thể.' };
    }
    const seo = await this.settings.resolveSeoGemini();
    if (!seo) {
      return {
        ...base,
        note: 'Chưa có khóa Gemini SEO. Vào Cấu hình AI, mục «Gemini SEO bài viết» — khóa này tách khỏi khóa upload JD và CV.',
      };
    }
    const pageLine = page && !page.error
      ? `Trang công khai ${page.path}: htmlChars ${page.htmlChars}, textChars ${page.textChars}, ratio ${page.ratio}%, script+style ${page.codeShare}%.`
      : 'Bài chưa có trang công khai để đo.';
    try {
      const raw = await this.settings.seoClient(seo).chat({
        system: [
          'Bạn là biên tập SEO cho bài tiếng Việt về tuyển dụng B2B và kỹ thuật công nghiệp.',
          'Nhiệm vụ: trích thực thể có trong bài (NLP entity extraction) và chấm độ phủ checklist B2B.',
          'Chỉ trả JSON, không markdown. Không bịa số; các số đo đã cho là cố định.',
          `Checklist B2B, dùng đúng tên: ${B2B_CHECKLIST.join('; ')}.`,
          'entities: tối đa 15 thực thể thực sự xuất hiện trong bài, mỗi cái có type (vị trí, kỹ năng, ngành, công cụ, doanh nghiệp, địa điểm, chứng chỉ, khái niệm).',
          'checklist: đủ 10 mục, covered=true chỉ khi bài thật sự nói về mục đó. Nếu covered=false, hint nói nên thêm câu hoặc đoạn gì, đặt dưới H2 nào.',
          'ratioAdvice: nhận xét tỷ lệ chữ trên HTML của bài và của trang công khai, chỉ ra có phải quá nhiều script/style không.',
          'suggestions: tối đa 5 việc cụ thể để AI Overviews dễ trích (định nghĩa ngắn đầu bài, danh sách, số liệu có nguồn, thực thể còn thiếu).',
          'faq: tối đa 3, câu trả lời bám đúng nội dung được đưa.',
          'Schema: {"entities":[{"name":"","type":""}],"checklist":[{"item":"","covered":true,"hint":""}],"coverageAdvice":"","ratioAdvice":"","suggestions":[""],"faq":[{"question":"","answer":""}]}',
        ].join(' '),
        user: [
          `Tiêu đề: ${input.title}`,
          `Từ khóa chính: ${input.focusKeyword || '(chưa đặt)'}`,
          `Nội dung bài: htmlChars ${measured.htmlChars}, textChars ${measured.textChars}, ratio ${measured.ratio}%.`,
          pageLine,
          `Dàn ý:\n${outline(input.html) || '(không có heading)'}`,
          `Nội dung:\n${text}`,
        ].join('\n'),
      });
      const parsed = parseScan(raw);
      if (!parsed) {
        return { ...base, note: 'Gemini SEO không trả JSON. Tỷ lệ chữ bên dưới vẫn là số đo tại chỗ.' };
      }
      const present = entitiesOf(parsed.entities);
      const checklist = checklistOf(parsed.checklist);
      const coveredCount = checklist.filter((item) => item.covered).length;
      const missing: CmsSemanticEntity[] = checklist
        .filter((item) => !item.covered)
        .map((item) => ({ name: item.item, present: false, type: 'checklist B2B', hint: item.hint || null }));
      return {
        source: 'gemini',
        textChars: measured.textChars,
        htmlChars: measured.htmlChars,
        ratio: measured.ratio,
        ratioVerdict: base.ratioVerdict,
        ratioAdvice: clip(parsed.ratioAdvice, 500) || base.ratioAdvice,
        page,
        coveredCount,
        checklistTotal: B2B_CHECKLIST.length,
        coverage: coverageFor(coveredCount),
        coverageAdvice: clip(parsed.coverageAdvice, 500),
        entities: [...present, ...missing],
        suggestions: strings(parsed.suggestions, 300).slice(0, 5),
        faq: faqOf(parsed.faq),
        note: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không gọi được Gemini SEO';
      return { ...base, note: `Gemini SEO lỗi: ${message.slice(0, 260)}` };
    }
  }
}

function coverageFor(covered: number): CmsSemanticCoverage {
  if (covered >= 6) return 'enough';
  if (covered >= 3) return 'partial';
  return 'thin';
}

function ratioVerdict(measured: { ratio: number; textChars: number }): CmsSemanticRatioVerdict {
  return measured.ratio < 40 || measured.textChars < 250 ? 'warn' : 'good';
}

function blankAssist(
  measured: { textChars: number; htmlChars: number; ratio: number },
  page: CmsPageRatio | null,
): CmsSemanticAssist {
  const verdict = ratioVerdict(measured);
  return {
    source: 'unavailable',
    textChars: measured.textChars,
    htmlChars: measured.htmlChars,
    ratio: measured.ratio,
    ratioVerdict: verdict,
    ratioAdvice:
      verdict === 'warn'
        ? 'Tỷ lệ chữ thấp hoặc bài còn ngắn. Thêm đoạn văn, bớt thẻ rỗng, để Gemini có chữ mà trích.'
        : 'Tỷ lệ chữ tạm ổn so với HTML đang lưu.',
    page,
    coveredCount: 0,
    checklistTotal: B2B_CHECKLIST.length,
    coverage: 'thin',
    coverageAdvice: '',
    entities: [],
    suggestions: [],
    faq: [],
    note: null,
  };
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function strings(value: unknown, max = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, max))
    .filter(Boolean);
}

function entitiesOf(value: unknown): CmsSemanticEntity[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CmsSemanticEntity[] = [];
  for (const item of value) {
    const name = typeof item === 'string' ? clip(item, 80) : clip((item as { name?: unknown })?.name, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const type = typeof item === 'object' && item ? clip((item as { type?: unknown }).type, 40) : '';
    out.push({ name, present: true, type: type || null, hint: null });
    if (out.length >= 15) break;
  }
  return out;
}

function checklistOf(value: unknown): Array<{ item: string; covered: boolean; hint: string }> {
  const byName = new Map<string, { covered: boolean; hint: string }>();
  if (Array.isArray(value)) {
    for (const row of value) {
      if (!row || typeof row !== 'object') continue;
      const item = clip((row as { item?: unknown }).item, 80);
      if (!item) continue;
      byName.set(item.toLowerCase(), {
        covered: (row as { covered?: unknown }).covered === true,
        hint: clip((row as { hint?: unknown }).hint, 500),
      });
    }
  }
  return B2B_CHECKLIST.map((item) => {
    const found = byName.get(item.toLowerCase());
    return { item, covered: found?.covered ?? false, hint: found?.hint ?? '' };
  });
}

function faqOf(value: unknown): CmsSemanticAssist['faq'] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const question = clip((item as { question?: unknown }).question, 180);
      const answer = clip((item as { answer?: unknown }).answer, 400);
      return question && answer ? [{ question, answer }] : [];
    })
    .slice(0, 3);
}

function parseScan(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
