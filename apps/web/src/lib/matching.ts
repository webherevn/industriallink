import type {
  CandidateMatchView,
  JobMatchView,
  MatchExplanation,
  OpenJobMatchBoard,
} from '@industriallink/contracts';
import { apiRequest, asArray } from './api';

function withMatch<T extends { match?: MatchExplanation }>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const next: T = { ...row };
  if ('skills' in row) {
    (next as T & { skills: unknown[] }).skills = asArray((row as { skills?: unknown }).skills);
  }
  if (row.match) {
    next.match = {
      ...row.match,
      matchedSkills: asArray(row.match.matchedSkills),
      missingSkills: asArray(row.match.missingSkills),
    };
  }
  return next;
}

export async function sourcingCandidatesForJob(jobId: string): Promise<CandidateMatchView[]> {
  return asArray<CandidateMatchView>(
    await apiRequest(`/matching/jobs/${jobId}/sourcing-candidates`),
  ).map(withMatch);
}

export async function openJobMatchBoards(): Promise<OpenJobMatchBoard[]> {
  return asArray<OpenJobMatchBoard>(await apiRequest('/matching/open-job-boards')).map((board) => ({
    ...board,
    candidates: asArray<CandidateMatchView>(board.candidates).map(withMatch),
  }));
}

export async function candidatesForJob(jobId: string): Promise<CandidateMatchView[]> {
  return asArray<CandidateMatchView>(await apiRequest(`/matching/jobs/${jobId}/candidates`)).map(
    withMatch,
  );
}

export async function jobFit(jobId: string): Promise<MatchExplanation> {
  const row = await apiRequest<MatchExplanation>(`/matching/jobs/${jobId}/fit`);
  return {
    ...row,
    matchedSkills: asArray(row?.matchedSkills),
    missingSkills: asArray(row?.missingSkills),
  };
}

export async function recommendedJobs(): Promise<JobMatchView[]> {
  return asArray<JobMatchView>(await apiRequest('/matching/recommended-jobs')).map((row) =>
    withMatch({ ...row, skills: asArray(row?.skills) }),
  );
}
