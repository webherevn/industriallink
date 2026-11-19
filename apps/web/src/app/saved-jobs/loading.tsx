import { ListSkeleton } from '@/components/page-skeleton';

export default function SavedJobsLoading() {
  return <ListSkeleton tone="candidate" rows={4} />;
}
