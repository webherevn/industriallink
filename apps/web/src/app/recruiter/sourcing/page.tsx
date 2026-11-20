import { RecruiterSourcingWorkspace } from '@/components/recruiter-sourcing-workspace';

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ copyJobId?: string }>;
}) {
  const { copyJobId } = await searchParams;
  return <RecruiterSourcingWorkspace copyJobId={copyJobId} />;
}
