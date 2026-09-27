import { cmsCategoryPagePath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string; parts?: string[] }>;
};

function parsePageNum(parts?: string[]): number {
  if (!parts || parts.length === 0) return 1;
  if (parts.length === 2 && parts[0] === 'page') {
    const n = Number(parts[1]);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return -1;
}

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: true } };
}

/** Đường cũ. Middleware đã 301; giữ redirect phòng khi request không qua middleware. */
export default async function LegacyCategoryRedirect({ params }: Props) {
  const { slug, parts } = await params;
  const pageNum = parsePageNum(parts);
  if (pageNum < 1) notFound();
  permanentRedirect(cmsCategoryPagePath(slug, pageNum));
}
