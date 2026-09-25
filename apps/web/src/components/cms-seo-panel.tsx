'use client';

import { useMemo } from 'react';
import { analyzeCmsSeo, type SeoCheck } from '@/lib/cms-seo-analysis';
import { BRAND_SITE_HOST } from '@/lib/brand';
import { Input } from '@/components/ui';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

type Props = {
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
  onFocusKeywordChange: (v: string) => void;
  onSeoTitleChange: (v: string) => void;
  onSeoDescriptionChange: (v: string) => void;
};

function StatusDot({ status }: { status: SeoCheck['status'] }) {
  const color =
    status === 'good' ? 'bg-emerald-500' : status === 'ok' ? 'bg-amber-400' : 'bg-rose-500';
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color =
    grade === 'great' || grade === 'good'
      ? 'text-emerald-600'
      : grade === 'ok'
        ? 'text-amber-600'
        : 'text-rose-600';
  const ring =
    grade === 'great' || grade === 'good'
      ? 'border-emerald-400'
      : grade === 'ok'
        ? 'border-amber-400'
        : 'border-rose-400';
  const label =
    grade === 'great' ? 'Rất tốt' : grade === 'good' ? 'Tốt' : grade === 'ok' ? 'Cần cải thiện' : 'Yếu';
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-[3px] bg-white ${ring}`}
      >
        <span className={`text-base font-bold leading-none ${color}`}>{score}</span>
        <span className="text-[9px] font-semibold uppercase text-slate-400">/100</span>
      </div>
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-slate-500">SEO Score · realtime</p>
      </div>
    </div>
  );
}

function CheckList({ title, items }: { title: string; items: SeoCheck[] }) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex gap-2 text-xs leading-snug text-slate-600">
            <StatusDot status={c.status} />
            <div>
              <p className="font-semibold text-slate-800">{c.label}</p>
              <p className="text-slate-500">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeoCharBar({
  label,
  value,
  softLimit,
}: {
  label: string;
  value: string;
  softLimit: number;
}) {
  const len = value.length;
  const pct = Math.min(100, Math.round((len / softLimit) * 100));
  const over = len > softLimit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={over ? 'font-semibold text-amber-600' : 'text-slate-400'}>
          {len}/{softLimit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={over ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CmsSeoPanel({
  title,
  slug,
  publicPath,
  bodyHtml,
  excerpt,
  seoTitle,
  seoDescription,
  focusKeyword,
  coverImageUrl,
  ogTitle,
  ogDescription,
  ogImageUrl,
  robotsIndex,
  onFocusKeywordChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
}: Props) {
  const analysis = useMemo(
    () =>
      analyzeCmsSeo({
        title,
        slug,
        publicPath,
        bodyHtml,
        excerpt,
        seoTitle,
        seoDescription,
        focusKeyword,
        coverImageUrl,
        ogTitle,
        ogDescription,
        ogImageUrl,
        robotsIndex,
        siteHost: BRAND_SITE_HOST,
      }),
    [
      title,
      slug,
      publicPath,
      bodyHtml,
      excerpt,
      seoTitle,
      seoDescription,
      focusKeyword,
      coverImageUrl,
      ogTitle,
      ogDescription,
      ogImageUrl,
      robotsIndex,
    ],
  );

  const socialTitle = ogTitle || seoTitle || title || 'Tiêu đề chia sẻ';
  const socialDesc =
    ogDescription || seoDescription || excerpt || 'Mô tả khi chia sẻ lên mạng xã hội.';
  const socialImg = resolveCmsAssetUrl(ogImageUrl || coverImageUrl);

  return (
    <div className="space-y-4">
      <ScoreRing score={analysis.score} grade={analysis.grade} />

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">Focus keyphrase</label>
        <Input
          value={focusKeyword}
          onChange={(e) => onFocusKeywordChange(e.target.value)}
          placeholder="VD: viết CV kỹ sư tự động hoá"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Dùng để chấm SEO realtime.
          {analysis.keywordDensity > 0 && ` · Mật độ ~${analysis.keywordDensity}%`}
          {` · ${analysis.wordCount} từ`}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Xem trước Google
        </p>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="truncate text-xs text-slate-600">{analysis.urlPreview}</p>
          <p className="mt-0.5 line-clamp-2 text-[1.05rem] leading-snug text-[#1a0dab] hover:underline">
            {analysis.titlePreview}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-[#4d5156]">
            {analysis.descPreview}
          </p>
        </div>
      </div>

      <SeoCharBar label="SEO Title" value={seoTitle || title} softLimit={60} />
      <Input
        value={seoTitle}
        onChange={(e) => onSeoTitleChange(e.target.value)}
        placeholder="Để trống = dùng tiêu đề bài"
      />
      <SeoCharBar label="Meta description" value={seoDescription || excerpt} softLimit={155} />
      <textarea
        className="cms-field-control min-h-[80px]"
        value={seoDescription}
        onChange={(e) => onSeoDescriptionChange(e.target.value)}
        placeholder="Meta description hấp dẫn, có keyphrase…"
      />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Xem trước Facebook / Zalo
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {socialImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={socialImg} alt="" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="flex aspect-[1.91/1] items-center justify-center bg-slate-100 text-xs text-slate-400">
              Chưa có ảnh OG
            </div>
          )}
          <div className="border-t border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{BRAND_SITE_HOST}</p>
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{socialTitle}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{socialDesc}</p>
          </div>
        </div>
      </div>

      <CheckList title="Phân tích cơ bản" items={analysis.basic} />
      <CheckList title="Phân tích bổ sung" items={analysis.additional} />
    </div>
  );
}
