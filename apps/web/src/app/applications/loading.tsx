import { ListSkeleton } from '@/components/page-skeleton';

export default function ApplicationsLoading() {
  return <ListSkeleton tone="candidate" rows={5} />;
}
