import { ListSkeleton } from '@/components/page-skeleton';

export default function RecommendedLoading() {
  return <ListSkeleton tone="candidate" rows={5} />;
}
