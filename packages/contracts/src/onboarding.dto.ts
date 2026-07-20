import { OnboardingStatus } from './enums';

export interface CreateOnboardingRequest {
  applicationId: string;
  startDate: string;
  reportLocation?: string;
  contactName?: string;
  contactPhone?: string;
  checklist?: string;
  notes?: string;
  /** true (mặc định): chuyển hồ sơ sang Hired. */
  moveToHired?: boolean;
}

export interface UpdateOnboardingRequest {
  status?: OnboardingStatus;
  startDate?: string;
  reportLocation?: string;
  contactName?: string;
  contactPhone?: string;
  checklist?: string;
  notes?: string;
}

export interface OnboardingView {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  status: OnboardingStatus;
  startDate: string;
  reportLocation: string | null;
  contactName: string | null;
  contactPhone: string | null;
  checklist: string | null;
  notes: string | null;
  createdAt: string;
}
