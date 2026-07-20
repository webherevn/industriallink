import { OfferStatus } from './enums';

export interface CreateOfferRequest {
  applicationId: string;
  salary: number;
  currency?: string;
  startDate?: string;
  expiresAt?: string;
  benefits?: string;
  notes?: string;
  /** true (mặc định): chuyển hồ sơ sang Offer. */
  moveToOffer?: boolean;
}

/** Ứng viên phản hồi đề nghị làm việc của chính mình. */
export interface RespondOfferRequest {
  status: OfferStatus.Accepted | OfferStatus.Declined;
}

export interface UpdateOfferRequest {
  status?: OfferStatus;
  salary?: number;
  currency?: string;
  startDate?: string;
  expiresAt?: string;
  benefits?: string;
  notes?: string;
}

export interface OfferView {
  id: string;
  code: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  status: OfferStatus;
  salary: number;
  currency: string;
  startDate: string | null;
  expiresAt: string | null;
  benefits: string | null;
  notes: string | null;
  createdAt: string;
}
