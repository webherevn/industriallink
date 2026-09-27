import { cmsCategoryPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { CategoryScreen, categoryMetadata } from '../../../cms-category-screen';

type Props = {
  params: Promise<{ slug: string; page: string }>;
};

function pageNumOf(raw: string): number {
  if (!/^\d+$/.test(raw)) return -1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return -1;
  return Math.floor(n);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const pageNum = pageNumOf(page);
  if (pageNum < 2) return { title: 'Không tìm thấy', robots: { index: false, follow: false } };
  return categoryMetadata(slug, pageNum);
}

export default async function CategoryPagedRoute({ params }: Props) {
  const { slug, page } = await params;
  const pageNum = pageNumOf(page);
  if (pageNum < 1) notFound();
  if (pageNum === 1) permanentRedirect(cmsCategoryPublicPath(slug));
  return <CategoryScreen slug={slug} pageNum={pageNum} />;
}
