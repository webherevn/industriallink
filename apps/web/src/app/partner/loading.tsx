import { PageSkeleton } from '@/components/page-skeleton';

export default function PartnerLoading() {
  return <PageSkeleton tone="candidate" cards={3} showHero />;
}
