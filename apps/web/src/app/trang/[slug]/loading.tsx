import { PageSkeleton } from '@/components/page-skeleton';

/** Trang bài CMS dùng `AppShell allowGuest flush bleed` → PublicHeader. */
export default function TrangLoading() {
  return <PageSkeleton tone="candidate" cards={2} chrome="public" />;
}
