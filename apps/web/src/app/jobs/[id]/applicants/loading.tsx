import { ListSkeleton } from '@/components/page-skeleton';

export default function JobApplicantsLoading() {
  return <ListSkeleton tone="recruiter" rows={6} />;
}
