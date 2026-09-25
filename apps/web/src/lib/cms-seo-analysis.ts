export type SeoCheckStatus = 'good' | 'ok' | 'bad';

export type SeoCheck = {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail: string;
};

export type SeoAnalysisInput = {
  title: string;
  slug: string;
  publicPath: string;
  bodyHtml: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  coverImageUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  siteHost?: string;
};

export type SeoAnalysisResult = {
  score: number;
  grade: 'great' | 'good' | 'ok' | 'bad';
  checks: SeoCheck[];
  basic: SeoCheck[];
  additional: SeoCheck[];
  titlePreview: string;
  descPreview: string;
  urlPreview: string;
  keywordDensity: number;
  wordCount: number;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function includesCi(hay: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return hay.toLowerCase().includes(needle.trim().toLowerCase());
}

function keywordCount(text: string, keyword: string): number {
  const k = keyword.trim().toLowerCase();
  if (!k) return 0;
  const hay = text.toLowerCase();
  let count = 0;
  let idx = 0;
  while (true) {
    const found = hay.indexOf(k, idx);
    if (found === -1) break;
    count += 1;
    idx = found + k.length;
  }
  return count;
}

function scoreOf(status: SeoCheckStatus): number {
  if (status === 'good') return 100;
  if (status === 'ok') return 55;
  return 10;
}

/**
 * Phân tích SEO client-side kiểu Yoast / Rank Math (focus keyphrase + checks cơ bản).
 */
export function analyzeCmsSeo(input: SeoAnalysisInput): SeoAnalysisResult {
  const kw = input.focusKeyword.trim();
  const title = (input.seoTitle || input.title).trim();
  const desc = (input.seoDescription || input.excerpt).trim();
  const plain = stripHtml(input.bodyHtml);
  const wordCount = countWords(plain);
  const host = input.siteHost || 'inlink.vn';
  const urlPreview = `${host}${input.publicPath}`;
  const kwInContent = keywordCount(plain, kw);
  const density = wordCount > 0 && kw ? Math.round((kwInContent / wordCount) * 1000) / 10 : 0;

  const basic: SeoCheck[] = [];
  const additional: SeoCheck[] = [];

  // —— Focus keyphrase ——
  if (!kw) {
    basic.push({
      id: 'kw-set',
      label: 'Focus keyphrase',
      status: 'bad',
      detail: 'Chưa đặt focus keyphrase.',
    });
  } else {
    basic.push({
      id: 'kw-set',
      label: 'Focus keyphrase',
      status: 'good',
      detail: `Đã đặt: “${kw}”.`,
    });

    basic.push({
      id: 'kw-title',
      label: 'Keyphrase trong SEO title',
      status: includesCi(title, kw) ? 'good' : 'bad',
      detail: includesCi(title, kw)
        ? 'Keyphrase xuất hiện trong tiêu đề SEO.'
        : 'Thêm keyphrase vào SEO title.',
    });

    basic.push({
      id: 'kw-meta',
      label: 'Keyphrase trong meta description',
      status: includesCi(desc, kw) ? 'good' : desc ? 'ok' : 'bad',
      detail: includesCi(desc, kw)
        ? 'Keyphrase có trong meta description.'
        : desc
          ? 'Nên đưa keyphrase vào meta description.'
          : 'Thiếu meta description.',
    });

    basic.push({
      id: 'kw-slug',
      label: 'Keyphrase trong URL',
      status: includesCi(input.slug.replace(/-/g, ' '), kw) || includesCi(input.slug, kw.replace(/\s+/g, '-'))
        ? 'good'
        : 'ok',
      detail:
        includesCi(input.slug.replace(/-/g, ' '), kw) || includesCi(input.slug, kw.replace(/\s+/g, '-'))
          ? 'Slug chứa chứa keyphrase.'
          : 'Slug chưa chứa keyphrase (không bắt buộc nhưng nên có).',
    });

    const inIntro = includesCi(plain.slice(0, Math.min(plain.length, 400)), kw);
    basic.push({
      id: 'kw-intro',
      label: 'Keyphrase ở đoạn mở đầu',
      status: inIntro ? 'good' : 'ok',
      detail: inIntro
        ? 'Keyphrase xuất hiện gần đầu nội dung.'
        : 'Nên nhắc keyphrase trong ~10% đầu bài.',
    });

    let densStatus: SeoCheckStatus = 'bad';
    let densDetail = 'Chưa thấy keyphrase trong nội dung.';
    if (kwInContent > 0) {
      if (density >= 0.5 && density <= 2.5) {
        densStatus = 'good';
        densDetail = `Mật độ keyphrase ~${density}% (ổn).`;
      } else if (density < 0.5) {
        densStatus = 'ok';
        densDetail = `Mật độ thấp (~${density}%). Thêm vài lần xuất hiện tự nhiên.`;
      } else {
        densStatus = 'ok';
        densDetail = `Mật độ cao (~${density}%). Tránh nhồi từ khoá.`;
      }
    }
    basic.push({
      id: 'kw-density',
      label: 'Mật độ keyphrase',
      status: densStatus,
      detail: densDetail,
    });
  }

  // —— Title / meta lengths ——
  const titleLen = title.length;
  basic.push({
    id: 'title-len',
    label: 'Độ dài SEO title',
    status: titleLen >= 30 && titleLen <= 60 ? 'good' : titleLen > 0 && titleLen <= 70 ? 'ok' : 'bad',
    detail:
      titleLen === 0
        ? 'Thiếu tiêu đề.'
        : titleLen < 30
          ? `Ngắn (${titleLen}/60). Nên 30–60 ký tự.`
          : titleLen <= 60
            ? `Tốt (${titleLen}/60).`
            : `Hơi dài (${titleLen}). Google có thể cắt tiêu đề.`,
  });

  const descLen = desc.length;
  basic.push({
    id: 'meta-len',
    label: 'Độ dài meta description',
    status:
      descLen >= 120 && descLen <= 160 ? 'good' : descLen >= 70 && descLen <= 180 ? 'ok' : 'bad',
    detail:
      descLen === 0
        ? 'Thiếu meta description.'
        : descLen < 120
          ? `Ngắn (${descLen}/155). Nên 120–160 ký tự.`
          : descLen <= 160
            ? `Tốt (${descLen}/155).`
            : `Dài (${descLen}). Có thể bị cắt trên SERP.`,
  });

  // —— Content ——
  additional.push({
    id: 'words',
    label: 'Độ dài nội dung',
    status: wordCount >= 600 ? 'good' : wordCount >= 300 ? 'ok' : 'bad',
    detail:
      wordCount >= 600
        ? `${wordCount} từ — đủ sâu cho SEO.`
        : wordCount >= 300
          ? `${wordCount} từ — tạm ổn, nên ≥ 600 từ.`
          : `${wordCount} từ — quá ngắn (nên ≥ 300).`,
  });

  const hasH2 = /<h2\b/i.test(input.bodyHtml);
  additional.push({
    id: 'h2',
    label: 'Tiêu đề phụ (H2)',
    status: hasH2 ? 'good' : 'ok',
    detail: hasH2 ? 'Có ít nhất một H2.' : 'Thêm H2 để cấu trúc nội dung rõ hơn.',
  });

  const imgs = [...input.bodyHtml.matchAll(/<img\b[^>]*>/gi)];
  const imgsWithAlt = imgs.filter((m) => /\balt\s*=\s*("[^"]+"|'[^']+')/i.test(m[0])).length;
  additional.push({
    id: 'img-alt',
    label: 'Ảnh trong bài + alt',
    status:
      imgs.length === 0 ? 'ok' : imgsWithAlt === imgs.length ? 'good' : imgsWithAlt > 0 ? 'ok' : 'bad',
    detail:
      imgs.length === 0
        ? 'Chưa có ảnh trong nội dung (tuỳ chọn).'
        : `${imgsWithAlt}/${imgs.length} ảnh có alt text.`,
  });

  const outbound = (input.bodyHtml.match(/<a\b[^>]*href\s*=\s*["']https?:\/\//gi) || []).length;
  const inbound = (input.bodyHtml.match(/<a\b[^>]*href\s*=\s*["']\//gi) || []).length;
  additional.push({
    id: 'links',
    label: 'Liên kết nội bộ / ngoại',
    status: inbound > 0 && outbound > 0 ? 'good' : inbound + outbound > 0 ? 'ok' : 'ok',
    detail: `Nội bộ: ${inbound} · Ngoại: ${outbound}. Nên có cả hai loại.`,
  });

  additional.push({
    id: 'cover',
    label: 'Ảnh đại diện',
    status: input.coverImageUrl ? 'good' : 'ok',
    detail: input.coverImageUrl ? 'Đã đặt ảnh đại diện.' : 'Nên đặt ảnh đại diện / OG.',
  });

  const ogOk = Boolean(input.ogImageUrl || input.coverImageUrl);
  additional.push({
    id: 'og',
    label: 'Open Graph image',
    status: ogOk ? 'good' : 'ok',
    detail: ogOk ? 'Có ảnh chia sẻ mạng xã hội.' : 'Thiếu OG image.',
  });

  additional.push({
    id: 'robots',
    label: 'Indexability',
    status: input.robotsIndex ? 'good' : 'ok',
    detail: input.robotsIndex
      ? 'Trang được phép index.'
      : 'Đang noindex — Google sẽ không xếp hạng URL này.',
  });

  // Readability rough
  const sentences = plain.split(/[.!?…]+/).filter((s) => s.trim().length > 8);
  const longSentences = sentences.filter((s) => countWords(s) > 25).length;
  const readRatio = sentences.length ? longSentences / sentences.length : 0;
  additional.push({
    id: 'readability',
    label: 'Độ dễ đọc (câu dài)',
    status: readRatio <= 0.25 ? 'good' : readRatio <= 0.4 ? 'ok' : 'bad',
    detail:
      sentences.length === 0
        ? 'Chưa đủ nội dung để đánh giá.'
        : `${Math.round(readRatio * 100)}% câu > 25 từ — ${
            readRatio <= 0.25 ? 'dễ đọc' : 'nên rút ngắn một số câu'
          }.`,
  });

  const checks = [...basic, ...additional];
  const score = Math.round(
    checks.reduce((sum, c) => sum + scoreOf(c.status), 0) / Math.max(checks.length, 1),
  );
  const grade: SeoAnalysisResult['grade'] =
    score >= 85 ? 'great' : score >= 70 ? 'good' : score >= 50 ? 'ok' : 'bad';

  return {
    score,
    grade,
    checks,
    basic,
    additional,
    titlePreview: title || 'Tiêu đề xem trước trên Google',
    descPreview: desc || 'Meta description sẽ hiển thị tại đây. Viết hấp dẫn, có keyphrase.',
    urlPreview,
    keywordDensity: density,
    wordCount,
  };
}
