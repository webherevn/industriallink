'use client';

import { MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { UserRole } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { CandidateSidebar } from '@/components/candidate-sidebar';
import { ConnectionChat } from '@/components/connection-chat';
import { fetchMe } from '@/lib/auth';
import { getMyCandidate } from '@/lib/candidate';

export default function CandidateChatPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const candidate = useQuery({
    queryKey: ['my-candidate'],
    queryFn: getMyCandidate,
    enabled: me.data?.role === UserRole.Candidate,
    retry: false,
  });
  const user = me.data;
  const isCandidate = user?.role === UserRole.Candidate;

  const board = (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-800">Chat</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Trao đổi với nhà tuyển dụng sau khi bạn chấp nhận kết nối.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <ConnectionChat embedded />
      </div>
    </div>
  );

  if (!isCandidate) {
    return <AppShell>{board}</AppShell>;
  }

  return (
    <AppShell wide>
      <div className="grid gap-5 pb-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <CandidateSidebar
          displayName={candidate.data?.displayName ?? user?.displayName ?? 'Ứng viên'}
          email={user?.email}
          hasAvatar={Boolean(candidate.data?.hasAvatar)}
          position={candidate.data?.profile?.currentPosition}
          profileCompletion={candidate.data?.profileCompletion}
        />
        {board}
      </div>
    </AppShell>
  );
}
