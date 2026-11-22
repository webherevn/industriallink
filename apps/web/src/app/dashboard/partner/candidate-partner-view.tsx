'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { PartnerIntroView } from '@/components/partner-intro-view';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';

export function CandidatePartnerView() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const { data: candidate } = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    retry: false,
  });

  const displayName = (candidate?.displayName ?? me?.displayName ?? 'Ứng viên').replace(/\r/g, '');

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CandidateSidebar
          displayName={displayName}
          position={candidate?.profile?.currentPosition}
          profileCompletion={candidate?.profileCompletion}
        />
        <div className="min-w-0">
          <PartnerIntroView />
        </div>
      </div>
    </AppShell>
  );
}
