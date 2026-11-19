import { ListSkeleton } from '@/components/page-skeleton';

export default function ManageJobsLoading() {
  return <ListSkeleton tone="recruiter" rows={5} />;
}
