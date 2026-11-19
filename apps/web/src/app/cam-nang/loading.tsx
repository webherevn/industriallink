import { PageSkeleton } from '@/components/page-skeleton';

/** Trang chuyên mục CMS dùng `AppShell allowGuest flush bleed` → PublicHeader. */
export default function CamNangLoading() {
  return <PageSkeleton tone="candidate" cards={3} chrome="public" />;
}
