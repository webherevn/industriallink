import { ListSkeleton } from '@/components/page-skeleton';

export default function ConnectionsLoading() {
  return <ListSkeleton tone="candidate" rows={4} />;
}
