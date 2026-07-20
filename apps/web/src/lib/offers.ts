import { OfferStatus, type CreateOfferRequest, type OfferView, type UpdateOfferRequest } from '@industriallink/contracts';
import { apiRequest } from './api';

export async function listOffers(params: {
  jobId?: string;
  status?: string;
} = {}): Promise<OfferView[]> {
  const qs = new URLSearchParams();
  if (params.jobId) qs.set('jobId', params.jobId);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/offers${suffix}`);
}

export async function listMyOffers(): Promise<OfferView[]> {
  return apiRequest('/offers/mine');
}

export async function createOffer(input: CreateOfferRequest): Promise<OfferView> {
  return apiRequest('/offers', { method: 'POST', body: input });
}

export async function updateOffer(
  id: string,
  input: UpdateOfferRequest,
): Promise<OfferView> {
  return apiRequest(`/offers/${id}`, { method: 'PATCH', body: input });
}

/** Ứng viên chấp nhận (accept=true) hoặc từ chối (accept=false) đề nghị làm việc của mình. */
export async function respondToOffer(id: string, accept: boolean): Promise<OfferView> {
  return apiRequest(`/offers/${id}/respond`, {
    method: 'PATCH',
    body: { status: accept ? OfferStatus.Accepted : OfferStatus.Declined },
  });
}
