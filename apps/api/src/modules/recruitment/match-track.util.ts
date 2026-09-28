import { shouldUseSalesMatchEngine, shouldUseTechnicalMatchEngine } from '@industriallink/contracts';

export type MatchTrack = 'sales' | 'technical';

/** Nhóm matching của tin — mirror matching.service (jobTrack / jobLevel prefix / criteria). */
export function jobMatchTrack(job: Parameters<typeof shouldUseTechnicalMatchEngine>[0]): MatchTrack | null {
  if (shouldUseTechnicalMatchEngine(job)) return 'technical';
  if (shouldUseSalesMatchEngine(job)) return 'sales';
  return null;
}

export function candidateMatchTrack(candidate: {
  profile?: { jobTrack?: string | null } | null;
}): MatchTrack | null {
  const t = candidate.profile?.jobTrack?.trim().toLowerCase();
  return t === 'sales' || t === 'technical' ? t : null;
}
