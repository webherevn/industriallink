import type {
  CreateCrmDealRequest,
  CreateCrmLeadRequest,
  CrmBoard,
  CrmDealView,
  CrmLeadView,
  MoveCrmDealRequest,
} from '@industriallink/contracts';
import { apiRequest } from './api';

export function fetchCrmBoard(): Promise<CrmBoard> {
  return apiRequest<CrmBoard>('/crm/board');
}

export function createCrmLead(body: CreateCrmLeadRequest): Promise<CrmLeadView> {
  return apiRequest<CrmLeadView>('/crm/leads', { method: 'POST', body });
}

export function createCrmDeal(body: CreateCrmDealRequest): Promise<CrmDealView> {
  return apiRequest<CrmDealView>('/crm/deals', { method: 'POST', body });
}

export function moveCrmDeal(id: string, body: MoveCrmDealRequest): Promise<CrmDealView> {
  return apiRequest<CrmDealView>(`/crm/deals/${id}/stage`, { method: 'PATCH', body });
}
