import { RecruiterSourcingWorkspace } from '@/components/recruiter-sourcing-workspace';

export default async function SourcingCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecruiterSourcingWorkspace campaignId={id} />;
}
