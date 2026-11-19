import { ListSkeleton } from '@/components/page-skeleton';

export default function NotificationsLoading() {
  return <ListSkeleton tone="candidate" rows={5} />;
}
