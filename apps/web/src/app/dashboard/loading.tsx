import { PageSkeleton } from '@/components/page-skeleton';

export default function DashboardLoading() {
  return <PageSkeleton tone="candidate" cards={3} />;
}
