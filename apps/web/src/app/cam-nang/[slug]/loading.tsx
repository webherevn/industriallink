import { PageSkeleton } from '@/components/page-skeleton';

/** Trang bài CMS dùng `AppShell allowGuest flush bleed` → PublicHeader. */
export default function CamNangArticleLoading() {
  return <PageSkeleton tone="candidate" cards={2} chrome="public" />;
}
