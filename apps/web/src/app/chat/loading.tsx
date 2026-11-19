import { PageSkeleton } from '@/components/page-skeleton';

export default function ChatLoading() {
  return <PageSkeleton tone="candidate" cards={1} />;
}
